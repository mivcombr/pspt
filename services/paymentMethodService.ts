import { supabase } from '../lib/supabase';

export interface HospitalPaymentMethod {
    id: string;
    hospital_id: string;
    name: string;
    is_automatic_repasse: boolean;
    created_at?: string;
    updated_at?: string;
}

export const paymentMethodService = {
    async getAll(hospitalId: string) {
        const { data, error } = await supabase
            .from('hospital_payment_methods')
            .select('*')
            .eq('hospital_id', hospitalId)
            .order('name');

        if (error) throw error;
        return data as HospitalPaymentMethod[];
    },

    async create(method: Omit<HospitalPaymentMethod, 'id' | 'created_at' | 'updated_at'>) {
        const { data, error } = await supabase
            .from('hospital_payment_methods')
            .insert(method)
            .select()
            .single();

        if (error) throw error;
        return data as HospitalPaymentMethod;
    },

    async update(id: string, updates: Partial<HospitalPaymentMethod>) {
        const { data, error } = await supabase
            .from('hospital_payment_methods')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as HospitalPaymentMethod;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('hospital_payment_methods')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
