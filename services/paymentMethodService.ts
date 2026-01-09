import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

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

        if (error) {
            logger.error({ action: 'read', entity: 'hospital_payment_methods', hospital_id: hospitalId, error }, 'crud');
            throw error;
        }
        return data as HospitalPaymentMethod[];
    },

    async create(method: Omit<HospitalPaymentMethod, 'id' | 'created_at' | 'updated_at'>) {
        const { data, error } = await supabase
            .from('hospital_payment_methods')
            .insert(method)
            .select()
            .single();

        if (error) {
            logger.error({ action: 'create', entity: 'hospital_payment_methods', error }, 'crud');
            throw error;
        }
        logger.info({ action: 'create', entity: 'hospital_payment_methods', id: data?.id }, 'crud');
        return data as HospitalPaymentMethod;
    },

    async update(id: string, updates: Partial<HospitalPaymentMethod>) {
        const { data, error } = await supabase
            .from('hospital_payment_methods')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error({ action: 'update', entity: 'hospital_payment_methods', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'update', entity: 'hospital_payment_methods', id, fields: Object.keys(updates || {}) }, 'crud');
        return data as HospitalPaymentMethod;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('hospital_payment_methods')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error({ action: 'delete', entity: 'hospital_payment_methods', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'delete', entity: 'hospital_payment_methods', id }, 'crud');
    }
};
