import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export interface CreateUserPayload {
    email: string;
    password: string;
    name: string;
    role: 'RECEPTION' | 'FINANCIAL';
    hospital_id: string;
}

const isAuthError = (error: any) => {
    const context = error?.context;
    const status = context?.status ?? context?.response?.status ?? error?.status;
    return (
        status === 401
    );
};

const ensureSession = async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
        logger.warn({ action: 'get', entity: 'auth', error: sessionError }, 'auth');
    }
    let session = sessionData.session;
    const now = Date.now();
    const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : null;
    const shouldRefresh = !session || (expiresAtMs !== null && expiresAtMs - now < 120_000);

    if (shouldRefresh) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
            logger.warn({ action: 'refresh', entity: 'auth', error: refreshError }, 'auth');
        }
        session = refreshed.session ?? session;
    }
    if (!session) {
        throw new Error('Sessão expirada. Faça login novamente.');
    }
    return session;
};

const invokeFunctionWithSession = async <T,>(name: string, body: Record<string, any>) => {
    await ensureSession();

    // supabase.functions.invoke automatically adds the Authorization header 
    // using the current session and the apikey header using the anon key.
    // Manual header addition is redundant and can cause issues.
    return supabase.functions.invoke<T>(name, {
        body,
    });
};

export const userService = {
    /**
     * Create a new user (requires admin privileges)
     * Calls the Edge Function to create user with Supabase Auth
     */
    async createUser(payload: CreateUserPayload) {
        const invokeCreateUser = async () => invokeFunctionWithSession('create-user', payload);

        let { data, error } = await invokeCreateUser();

        // If it's a 401, we don't catch it here anymore, we let the detailed handler below deal with it.

        if (error) {
            console.error('Error invoking create-user function:', error);
            logger.error({ action: 'create', entity: 'profiles', error }, 'crud');
            let message = error.message || 'Failed to create user';
            const context = (error as any)?.context;
            const status = context?.status ?? context?.response?.status ?? (error as any)?.status;
            const body = context?.body;
            const response = context?.response ?? (error as any)?.response ?? context;
            const applyParsedMessage = (parsed: any, fallbackText?: string) => {
                if (parsed?.error) {
                    message = parsed.error;
                } else if (parsed?.message) {
                    message = parsed.message;
                } else if (fallbackText) {
                    message = fallbackText;
                }
            };

            if (body) {
                try {
                    if (typeof body === 'string') {
                        applyParsedMessage(JSON.parse(body), body.trim() ? body : undefined);
                    } else if (body instanceof Uint8Array) {
                        const text = new TextDecoder().decode(body);
                        applyParsedMessage(JSON.parse(text), text.trim() ? text : undefined);
                    } else if (typeof body === 'object') {
                        applyParsedMessage(body);
                    }
                } catch {
                    if (typeof body === 'string' && body.trim()) {
                        message = body;
                    }
                }
            }

            if (response && typeof response.json === 'function') {
                try {
                    const parsed = await response.json();
                    applyParsedMessage(parsed);
                } catch {
                    // Ignore JSON parse errors and fall back.
                }
            }

            if (response && typeof response.text === 'function') {
                try {
                    const text = await response.text();
                    if (text) {
                        try {
                            applyParsedMessage(JSON.parse(text), text);
                        } catch {
                            applyParsedMessage(null, text);
                        }
                    }
                } catch {
                    // Keep fallback message.
                }
            }

            const normalized = message.toLowerCase();
            if (
                status === 409
                || normalized.includes('already registered')
                || normalized.includes('already exists')
                || normalized.includes('user already registered')
                || normalized.includes('email already')
            ) {
                message = 'E-mail já cadastrado. Use outro e-mail ou recupere o acesso.';
            }

            if (status === 401) {
                // If it's a 401, it could be that the token is invalid or the function is rejecting it.
                // We add more context if available.
                const details = (error as any)?.details;
                message = details ? `Sessão inválida: ${details}` : 'Sessão expirada. Faça login novamente.';
                console.warn('Authentication error from Edge Function:', { status, message, details, error });
            }

            if (
                status === 403
                || normalized.includes('admin access required')
                || normalized.includes('forbidden')
                || normalized.includes('acesso negado')
            ) {
                message = 'Acesso negado. Sua conta precisa ser ADMIN para realizar esta ação.';
            }

            if (normalized.includes('non-2xx') && !body) {
                message = 'Erro na comunicação com o servidor. Tente novamente em instantes.';
            }
            throw new Error(message);
        }

        logger.info({ action: 'create', entity: 'profiles' }, 'crud');
        return data;
    },

    /**
     * Get all users for a specific hospital
     */
    async getUsersByHospital(hospitalId: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('hospital_id', hospitalId)
            .order('name');

        if (error) {
            logger.error({ action: 'read', entity: 'profiles', hospital_id: hospitalId, error }, 'crud');
            throw error;
        }
        return data;
    },

    /**
     * Update user profile
     */
    async updateUser(userId: string, updates: Partial<CreateUserPayload>) {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            logger.error({ action: 'update', entity: 'profiles', id: userId, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'update', entity: 'profiles', id: userId, fields: Object.keys(updates || {}) }, 'crud');
        return data;
    },

    /**
     * Delete user profile (Note: This doesn't delete the Auth user)
     */
    async deleteUser(userId: string) {
        const invokeDeleteUser = async () => invokeFunctionWithSession('delete-user', { user_id: userId });

        let { error } = await invokeDeleteUser();

        if (error) {
            const context = (error as any)?.context;
            const status = context?.status ?? context?.response?.status ?? (error as any)?.status;
            const normalized = (error?.message || '').toLowerCase();

            if (status === 401) {
                const details = (error as any)?.details;
                throw new Error(details ? `Sessão inválida: ${details}` : 'Sessão expirada. Faça login novamente.');
            }
            if (
                status === 403
                || normalized.includes('admin access required')
                || normalized.includes('forbidden')
                || normalized.includes('acesso negado')
            ) {
                throw new Error('Acesso negado. Sua conta precisa ser ADMIN para excluir usuários.');
            }
            logger.error({ action: 'delete', entity: 'profiles', id: userId, error, fallback: 'profile-only' }, 'crud');
            const { error: profileError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (profileError) {
                throw profileError;
            }
        }
        logger.info({ action: 'delete', entity: 'profiles', id: userId }, 'crud');
    }
};
