import { supabase } from '../lib/supabase';

export interface Procedure {
    id: string;
    name: string;
    standard_price: number;
    cash_price: number;
    repasse_value: number;
    type: 'Consulta' | 'Exame' | 'Cirurgia';
}

export const procedureService = {
    async getAll() {
        const { data, error } = await supabase
            .from('procedures_price_list')
            .select('*')
            .order('name');

        if (error) throw error;
        return data as Procedure[];
    },

    async create(procedure: Omit<Procedure, 'id'>) {
        const { data: { user } } = await supabase.auth.getUser();

        const payload = {
            ...procedure,
            user_id: user?.id
        };

        const { data, error } = await supabase
            .from('procedures_price_list')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async update(id: string, updates: Partial<Procedure>) {
        const { data, error } = await supabase
            .from('procedures_price_list')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('procedures_price_list')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
