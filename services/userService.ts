import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export interface CreateUserPayload {
    email: string;
    password: string;
    name: string;
    role: 'RECEPTION' | 'FINANCIAL';
    hospital_id: string;
}

export const userService = {
    /**
     * Create a new user (requires admin privileges)
     * Calls the Edge Function to create user with Supabase Auth
     */
    async createUser(payload: CreateUserPayload) {
        const { data, error } = await supabase.functions.invoke('create-user', {
            body: payload,
        });

        if (error) {
            console.error('Error invoking create-user function:', error);
            logger.error({ action: 'create', entity: 'profiles', error }, 'crud');
            throw new Error(error.message || 'Failed to create user');
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
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (error) {
            logger.error({ action: 'delete', entity: 'profiles', id: userId, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'delete', entity: 'profiles', id: userId }, 'crud');
    }
};
