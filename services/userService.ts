import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export interface CreateUserPayload {
    email: string;
    password: string;
    name: string;
    role: 'RECEPTION' | 'FINANCIAL';
    hospital_id: string;
}

const invokeFunctionWithSession = async <T,>(name: string, body: Record<string, any>) => {
    // 1. Ensure we have a fresh session
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    let session = currentSession;

    const now = Math.floor(Date.now() / 1000);
    const isExpiring = session?.expires_at && (session.expires_at - now < 300);

    if (!session || isExpiring) {
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        if (refreshedSession) session = refreshedSession;
    }

    if (!session) {
        throw new Error('Sessão expirada. Por favor, saia e entre novamente no sistema.');
    }

    // 2. Invoke function
    // We let Supabase handle the Authorization header automatically since we have a session
    const { data, error } = await supabase.functions.invoke<T>(name, {
        body
    });

    if (error) {
        console.error(`Edge Function error (${name}):`, error);

        let message = 'Erro ao processar solicitação.';

        // Try to get a more specific error from the context
        const context = (error as any).context;
        if (context?.response) {
            try {
                // If the response is available, try to parse its JSON content
                const response = context.response;
                if (typeof response.clone === 'function') {
                    const clonedRes = response.clone();
                    const text = await clonedRes.text();
                    try {
                        const parsed = JSON.parse(text);
                        if (parsed.error) message = parsed.error;
                        if (parsed.details) message += ` (${parsed.details})`;
                    } catch {
                        if (text && text.length < 200) message = text;
                    }
                }
            } catch (e) {
                console.error('Error parsing function response error:', e);
            }
        } else if (error.message && !error.message.includes('non-2xx')) {
            message = error.message;
        }

        throw new Error(message);
    }

    return { data, error: null };
};

export const userService = {
    /**
     * Create a new user (requires admin privileges)
     */
    async createUser(payload: CreateUserPayload) {
        try {
            const { data } = await invokeFunctionWithSession('create-user', payload);
            logger.info({ action: 'create', entity: 'profiles', email: payload.email }, 'crud');
            return data;
        } catch (error: any) {
            logger.error({ action: 'create', entity: 'profiles', error: error.message }, 'crud');
            throw error;
        }
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
            logger.error({ action: 'update', entity: 'profiles', user_id: userId, error }, 'crud');
            throw error;
        }
        return data;
    },

    /**
     * Delete user (requires admin privileges)
     */
    async deleteUser(userId: string) {
        try {
            const { data } = await invokeFunctionWithSession('delete-user', { userId });
            logger.info({ action: 'delete', entity: 'profiles', user_id: userId }, 'crud');
            return data;
        } catch (error: any) {
            logger.error({ action: 'delete', entity: 'profiles', error: error.message }, 'crud');
            throw error;
        }
    }
};
