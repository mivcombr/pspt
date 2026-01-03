import { supabase } from '../lib/supabase';

export const hospitalService = {
    async getAll() {
        const { data, error } = await supabase
            .from('hospitals')
            .select('*')
            .order('name');

        if (error) throw error;
        return data;
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('hospitals')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    async create(hospital: any) {
        const { data: { user } } = await supabase.auth.getUser();

        const payload = {
            ...hospital,
            user_id: user?.id
        };

        const { data, error } = await supabase
            .from('hospitals')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async update(id: string, updates: any) {
        const { data, error } = await supabase
            .from('hospitals')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('hospitals')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
