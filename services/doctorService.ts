import { supabase } from '../lib/supabase';

export interface Doctor {
    id: string;
    name: string;
    specialty?: string;
    hospital_id: string;
    crm?: string;
    active: boolean;
}

export const doctorService = {
    async getAll() {
        const { data, error } = await supabase
            .from('doctors')
            .select('*, hospital:hospitals(name)')
            .order('name');

        if (error) throw error;
        return data;
    },

    async getByHospital(hospitalId: string) {
        const { data, error } = await supabase
            .from('doctors')
            .select('*')
            .eq('hospital_id', hospitalId)
            .eq('active', true)
            .order('name');

        if (error) throw error;
        return data;
    },

    async create(doctor: Omit<Doctor, 'id'>) {
        const { data: { user } } = await supabase.auth.getUser();

        const payload = {
            ...doctor,
            user_id: user?.id
        };

        const { data, error } = await supabase
            .from('doctors')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async update(id: string, updates: Partial<Doctor>) {
        const { data, error } = await supabase
            .from('doctors')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('doctors')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
