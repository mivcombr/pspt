import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export interface Procedure {
    id: string;
    name: string;
    standard_price: number;
    cash_price: number;
    repasse_value: number;
    type: 'Consulta' | 'Exame' | 'Cirurgia';
    hospital_id?: string;
}

export const procedureService = {
    async getAll(hospitalId?: string) {
        let query = supabase
            .from('procedures_price_list')
            .select('*');

        if (hospitalId) {
            query = query.eq('hospital_id', hospitalId);
        }

        const { data, error } = await query.order('name');

        if (error) {
            logger.error({ action: 'read', entity: 'procedures_price_list', error }, 'crud');
            throw error;
        }
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

        if (error) {
            logger.error({ action: 'create', entity: 'procedures_price_list', error }, 'crud');
            throw error;
        }
        logger.info({ action: 'create', entity: 'procedures_price_list', id: data?.id }, 'crud');
        return data;
    },

    async update(id: string, updates: Partial<Procedure>) {
        const { data, error } = await supabase
            .from('procedures_price_list')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error({ action: 'update', entity: 'procedures_price_list', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'update', entity: 'procedures_price_list', id, fields: Object.keys(updates || {}) }, 'crud');
        return data;
    },
    async delete(id: string) {
        const { error } = await supabase
            .from('procedures_price_list')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error({ action: 'delete', entity: 'procedures_price_list', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'delete', entity: 'procedures_price_list', id }, 'crud');
    }
};
