import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export interface Withdrawal {
    id: string;
    partner_name: string;
    date: string;
    value: number;
    description?: string;
    hospital_id?: string;
}

const stripUndefined = <T extends Record<string, unknown>>(value: T): T =>
    Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;

export const withdrawalService = {
    async getAll(filters?: { startDate?: string; endDate?: string; hospitalId?: string }) {
        let query = supabase
            .from('withdrawals')
            .select('*');

        if (filters?.startDate) {
            query = query.gte('date', filters.startDate);
        }

        if (filters?.endDate) {
            query = query.lte('date', filters.endDate);
        }

        if (filters?.hospitalId) {
            query = query.eq('hospital_id', filters.hospitalId);
        }

        let { data, error } = await query.order('date', { ascending: false });

        if (error && error.message.includes('column "hospital_id" does not exist')) {
            let retryQuery = supabase
                .from('withdrawals')
                .select('*');

            if (filters?.startDate) {
                retryQuery = retryQuery.gte('date', filters.startDate);
            }

            if (filters?.endDate) {
                retryQuery = retryQuery.lte('date', filters.endDate);
            }

            const retry = await retryQuery.order('date', { ascending: false });
            data = retry.data;
            error = retry.error;
        }

        if (error) {
            logger.error({ action: 'read', entity: 'withdrawals', error }, 'crud');
            throw error;
        }
        return data as Withdrawal[];
    },

    async create(withdrawal: Omit<Withdrawal, 'id'>) {
        let payload = stripUndefined({ ...withdrawal });

        let { data, error } = await supabase
            .from('withdrawals')
            .insert([payload])
            .select()
            .single();

        if (error && error.message.includes('column "hospital_id" does not exist')) {
            payload = stripUndefined({ ...withdrawal, hospital_id: undefined });
            const retry = await supabase
                .from('withdrawals')
                .insert([payload])
                .select()
                .single();
            data = retry.data;
            error = retry.error;
        }

        if (error) {
            logger.error({ action: 'create', entity: 'withdrawals', error }, 'crud');
            throw error;
        }
        logger.info({ action: 'create', entity: 'withdrawals', id: data?.id }, 'crud');
        return data;
    },

    async update(id: string, updates: Partial<Withdrawal>) {
        const { data, error } = await supabase
            .from('withdrawals')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error({ action: 'update', entity: 'withdrawals', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'update', entity: 'withdrawals', id, fields: Object.keys(updates || {}) }, 'crud');
        return data;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('withdrawals')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error({ action: 'delete', entity: 'withdrawals', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'delete', entity: 'withdrawals', id }, 'crud');
    }
};
