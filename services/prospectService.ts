import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { Prospect, ProspectActivity, ProspectStage } from '../types';

export const prospectService = {
    async getAll(): Promise<Prospect[]> {
        const { data, error } = await supabase
            .from('prospects')
            .select('*')
            .order('stage')
            .order('position');

        if (error) {
            logger.error({ action: 'read', entity: 'prospects', error }, 'crud');
            throw error;
        }
        return (data || []) as Prospect[];
    },

    async create(prospect: Partial<Prospect>): Promise<Prospect> {
        const { data: { user } } = await supabase.auth.getUser();

        const payload = {
            ...prospect,
            created_by: user?.id ?? null,
        };

        const { data, error } = await supabase
            .from('prospects')
            .insert(payload)
            .select()
            .single();

        if (error) {
            logger.error({ action: 'create', entity: 'prospects', error }, 'crud');
            throw error;
        }
        logger.info({ action: 'create', entity: 'prospects', id: data?.id }, 'crud');
        return data as Prospect;
    },

    async update(id: string, updates: Partial<Prospect>): Promise<Prospect> {
        const { data, error } = await supabase
            .from('prospects')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error({ action: 'update', entity: 'prospects', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'update', entity: 'prospects', id, fields: Object.keys(updates || {}) }, 'crud');
        return data as Prospect;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('prospects')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error({ action: 'delete', entity: 'prospects', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'delete', entity: 'prospects', id }, 'crud');
    },

    /**
     * Persiste a nova ordem/coluna dos cards afetados por um arrastar-e-soltar.
     * O kanban já atualizou a tela otimisticamente; aqui só gravamos o resultado.
     */
    async reorder(moves: { id: string; stage: ProspectStage; position: number }[]): Promise<void> {
        if (moves.length === 0) return;

        const results = await Promise.all(
            moves.map(({ id, stage, position }) =>
                supabase.from('prospects').update({ stage, position }).eq('id', id)
            )
        );

        const failed = results.find(r => r.error);
        if (failed?.error) {
            logger.error({ action: 'update', entity: 'prospects', error: failed.error }, 'crud');
            throw failed.error;
        }
        logger.info({ action: 'update', entity: 'prospects', count: moves.length }, 'crud');
    },

    async getActivities(prospectId: string): Promise<ProspectActivity[]> {
        const { data, error } = await supabase
            .from('prospect_activities')
            .select('*')
            .eq('prospect_id', prospectId)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error({ action: 'read', entity: 'prospect_activities', id: prospectId, error }, 'crud');
            throw error;
        }
        return (data || []) as ProspectActivity[];
    },

    async addActivity(activity: {
        prospect_id: string;
        type: ProspectActivity['type'];
        content: string;
        author_name?: string;
    }): Promise<ProspectActivity> {
        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('prospect_activities')
            .insert({ ...activity, author_id: user?.id ?? null })
            .select()
            .single();

        if (error) {
            logger.error({ action: 'create', entity: 'prospect_activities', error }, 'crud');
            throw error;
        }
        return data as ProspectActivity;
    },

    async deleteActivity(id: string): Promise<void> {
        const { error } = await supabase
            .from('prospect_activities')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error({ action: 'delete', entity: 'prospect_activities', id, error }, 'crud');
            throw error;
        }
    },
};
