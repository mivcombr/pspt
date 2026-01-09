import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

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

        if (error) {
            logger.error({ action: 'read', entity: 'doctors', error }, 'crud');
            throw error;
        }
        return data;
    },

    async getByHospital(hospitalId: string) {
        const { data, error } = await supabase
            .from('doctors')
            .select('*')
            .eq('hospital_id', hospitalId)
            .eq('active', true)
            .order('name');

        if (error) {
            logger.error({ action: 'read', entity: 'doctors', hospital_id: hospitalId, error }, 'crud');
            throw error;
        }
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

        if (error) {
            logger.error({ action: 'create', entity: 'doctors', error }, 'crud');
            throw error;
        }
        logger.info({ action: 'create', entity: 'doctors', id: data?.id }, 'crud');
        return data;
    },

    async update(id: string, updates: Partial<Doctor>) {
        const { data, error } = await supabase
            .from('doctors')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error({ action: 'update', entity: 'doctors', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'update', entity: 'doctors', id, fields: Object.keys(updates || {}) }, 'crud');
        return data;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('doctors')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error({ action: 'delete', entity: 'doctors', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'delete', entity: 'doctors', id }, 'crud');
    }
};
