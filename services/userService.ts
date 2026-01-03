import { supabase } from '../lib/supabase';

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
            throw new Error(error.message || 'Failed to create user');
        }

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

        if (error) throw error;
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

        if (error) throw error;
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

        if (error) throw error;
    }
};
