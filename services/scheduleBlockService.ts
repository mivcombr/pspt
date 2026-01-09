import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export interface ScheduleBlock {
    id: string;
    hospital_id: string;
    block_type: 'SPECIFIC_DAY' | 'WEEKLY_RECURRING';
    date?: string;
    day_of_week?: number;
    start_time?: string;
    end_time?: string;
    reason?: string;
    created_at?: string;
}

export const scheduleBlockService = {
    async getAll(filters: { hospitalId?: string } = {}) {
        let query = supabase
            .from('schedule_blocks')
            .select('*');

        if (filters.hospitalId) {
            query = query.eq('hospital_id', filters.hospitalId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            logger.error({ action: 'read', entity: 'schedule_blocks', error }, 'crud');
            throw error;
        }
        return data as ScheduleBlock[];
    },

    async create(block: Omit<ScheduleBlock, 'id' | 'created_at'>) {
        const { data, error } = await supabase
            .from('schedule_blocks')
            .insert(block)
            .select()
            .single();

        if (error) {
            logger.error({ action: 'create', entity: 'schedule_blocks', error }, 'crud');
            throw error;
        }
        logger.info({ action: 'create', entity: 'schedule_blocks', id: data?.id }, 'crud');
        return data as ScheduleBlock;
    },

    async update(id: string, updates: Partial<ScheduleBlock>) {
        const { data, error } = await supabase
            .from('schedule_blocks')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error({ action: 'update', entity: 'schedule_blocks', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'update', entity: 'schedule_blocks', id, fields: Object.keys(updates || {}) }, 'crud');
        return data as ScheduleBlock;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('schedule_blocks')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error({ action: 'delete', entity: 'schedule_blocks', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'delete', entity: 'schedule_blocks', id }, 'crud');
    }
};
