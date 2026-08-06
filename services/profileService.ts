import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export const profileService = {
    async getByHospital(hospitalId: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('hospital_id', hospitalId);

        if (error) {
            logger.error({ action: 'read', entity: 'profiles', hospital_id: hospitalId, error }, 'crud');
            throw error;
        }
        return data;
    },

    async getAll() {
        const { data, error } = await supabase
            .from('profiles')
            .select('*, hospitals(name)')
            .order('name');

        if (error) {
            logger.error({ action: 'read', entity: 'profiles', error }, 'crud');
            throw error;
        }
        return data;
    },

    // Nomes de um conjunto de usuários. A RLS de profiles só libera a leitura de
    // outros perfis para admin/comercial, então o chamador precisa checar o papel.
    async getNamesByIds(ids: string[]) {
        if (ids.length === 0) return [];

        const { data, error } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', ids);

        if (error) {
            logger.error({ action: 'read', entity: 'profiles', error }, 'crud');
            throw error;
        }
        return data || [];
    },

    // Nome + e-mail de um conjunto de usuários, para identificar autores de
    // registros (auditoria). Mesma restrição de RLS do getNamesByIds.
    async getBasicByIds(ids: string[]) {
        if (ids.length === 0) return [];

        const { data, error } = await supabase
            .from('profiles')
            .select('id, name, email')
            .in('id', ids);

        if (error) {
            logger.error({ action: 'read', entity: 'profiles', error }, 'crud');
            throw error;
        }
        return data || [];
    },

    async update(id: string, updates: any) {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error({ action: 'update', entity: 'profiles', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'update', entity: 'profiles', id, fields: Object.keys(updates || {}) }, 'crud');
        return data;
    }
};
