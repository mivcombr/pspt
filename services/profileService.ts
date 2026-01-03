import { supabase } from '../lib/supabase';

export const profileService = {
    async getByHospital(hospitalId: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('hospital_id', hospitalId);

        if (error) throw error;
        return data;
    },

    async getAll() {
        const { data, error } = await supabase
            .from('profiles')
            .select('*, hospitals(name)')
            .order('name');

        if (error) throw error;
        return data;
    },

    async update(id: string, updates: any) {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
