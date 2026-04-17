import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export interface CreateUserPayload {
    email: string;
    password?: string;
    name: string;
    role: 'RECEPTION' | 'FINANCIAL' | 'COMMERCIAL' | 'ADMIN';
    hospital_id?: string | null;
}

export interface CreateUserResponse {
    success: boolean;
    user_id: string;
    temporary_password?: string;
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
    async createUser(payload: CreateUserPayload): Promise<CreateUserResponse> {
        try {
            const { data } = await invokeFunctionWithSession<CreateUserResponse>('create-user', payload);
            logger.info({ action: 'create', entity: 'profiles', email: payload.email }, 'crud');
            return data as CreateUserResponse;
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
    },

    /**
     * Get all users via v_access_overview view (Super Admin / Admin)
     */
    async getAllAccessOverview() {
        const { data, error } = await supabase
            .from('v_access_overview')
            .select('*')
            .order('name');

        if (error) {
            logger.error({ action: 'read', entity: 'v_access_overview', error }, 'crud');
            throw error;
        }
        return data;
    },

    /**
     * Get audit log entries
     */
    async getAuditLog(limit = 200) {
        const { data, error } = await supabase
            .from('access_audit_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            logger.error({ action: 'read', entity: 'access_audit_log', error }, 'crud');
            throw error;
        }
        return data;
    },

    /**
     * Manage user: activate, deactivate, set role, set hospital
     */
    async manageUser(userId: string, action: string, value?: string | null) {
        let updates: Record<string, any> = {};

        switch (action) {
            case 'ACTIVATE':
                updates = { is_active: true };
                break;
            case 'DEACTIVATE':
                updates = { is_active: false };
                break;
            case 'SET_ROLE':
                updates = { role: value };
                break;
            case 'SET_HOSPITAL':
                updates = { hospital_id: value || null };
                break;
            default:
                throw new Error(`Ação desconhecida: ${action}`);
        }

        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            logger.error({ action: 'manage', entity: 'profiles', user_id: userId, error }, 'crud');
            throw error;
        }

        // Log to audit
        const { data: { user: me } } = await supabase.auth.getUser();
        await supabase.from('access_audit_log').insert({
            actor_id: me?.id,
            actor_email: me?.email,
            target_id: userId,
            action,
            metadata: { value },
        });

        return data;
    },
};
