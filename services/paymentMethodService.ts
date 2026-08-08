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

    /**
     * Nomes distintos das formas de pagamento, para alimentar filtros.
     * Sem hospitalId, traz de todos os hospitais visíveis ao usuário pela RLS.
     * Deduplica ignorando caixa e espaços — a base tem "Cartão de crédito" e
     * "Cartão de Crédito" convivendo.
     */
    async getNames(hospitalId?: string) {
        let query = supabase
            .from('hospital_payment_methods')
            .select('name');

        if (hospitalId) {
            query = query.eq('hospital_id', hospitalId);
        }

        const { data, error } = await query;

        if (error) {
            logger.error({ action: 'read', entity: 'hospital_payment_methods', error }, 'crud');
            throw error;
        }

        const unique = new Map<string, string>();
        (data || []).forEach((row: any) => {
            const name = (row.name || '').trim();
            if (!name) return;
            const key = name.toLowerCase();
            if (!unique.has(key)) unique.set(key, name);
        });

        return Array.from(unique.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
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
