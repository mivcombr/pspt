import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export const hospitalService = {
    async getAll() {
        const { data, error } = await supabase
            .from('hospitals')
            .select('*')
            .order('name');

        if (error) {
            logger.error({ action: 'read', entity: 'hospitals', error }, 'crud');
            throw error;
        }
        return data;
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('hospitals')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            logger.error({ action: 'read', entity: 'hospitals', id, error }, 'crud');
            throw error;
        }
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

        if (error) {
            logger.error({ action: 'create', entity: 'hospitals', error }, 'crud');
            throw error;
        }
        logger.info({ action: 'create', entity: 'hospitals', id: data?.id }, 'crud');
        return data;
    },

    async update(id: string, updates: any) {
        const { data, error } = await supabase
            .from('hospitals')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error({ action: 'update', entity: 'hospitals', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'update', entity: 'hospitals', id, fields: Object.keys(updates || {}) }, 'crud');
        return data;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('hospitals')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error({ action: 'delete', entity: 'hospitals', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'delete', entity: 'hospitals', id }, 'crud');
    }
};
