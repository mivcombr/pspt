import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export interface ExpenseCategory {
    id: string;
    name: string;
    type: 'Fixa' | 'Variável';
}

export interface Expense {
    id: string;
    description: string;
    category_id: string;
    hospital_id?: string;
    due_date: string;
    paid_date?: string;
    value: number;
    status: 'Pago' | 'Pendente';
    recurrence: string;
    category?: ExpenseCategory;
}

const stripUndefined = <T extends Record<string, unknown>>(value: T): T =>
    Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;

export const expenseService = {
    async getAll(filters?: { startDate?: string; endDate?: string; hospitalId?: string }) {
        let query = supabase
            .from('expenses')
            .select(`
                *,
                category:expense_categories(*)
            `);

        if (filters?.startDate) {
            query = query.gte('due_date', filters.startDate);
        }

        if (filters?.endDate) {
            query = query.lte('due_date', filters.endDate);
        }

        if (filters?.hospitalId) {
            query = query.eq('hospital_id', filters.hospitalId);
        }

        let { data, error } = await query.order('due_date', { ascending: false });

        if (error && error.message.includes('column "hospital_id" does not exist')) {
            let retryQuery = supabase
                .from('expenses')
                .select(`
                    *,
                    category:expense_categories(*)
                `);

            if (filters?.startDate) {
                retryQuery = retryQuery.gte('due_date', filters.startDate);
            }

            if (filters?.endDate) {
                retryQuery = retryQuery.lte('due_date', filters.endDate);
            }

            const retry = await retryQuery.order('due_date', { ascending: false });
            data = retry.data;
            error = retry.error;
        }

        if (error) {
            logger.error({ action: 'read', entity: 'expenses', error }, 'crud');
            throw error;
        }
        return data as Expense[];
    },

    async create(expense: Omit<Expense, 'id' | 'category'>) {
        const { data: { user } } = await supabase.auth.getUser();

        let payload = stripUndefined({
            ...expense,
            user_id: user?.id
        });

        let { data, error } = await supabase
            .from('expenses')
            .insert([payload])
            .select()
            .single();

        if (error && (error.message.includes('column "user_id" does not exist') || error.message.includes('column "hospital_id" does not exist'))) {
            payload = stripUndefined({
                ...expense
            });
            const retry = await supabase
                .from('expenses')
                .insert([payload])
                .select()
                .single();
            data = retry.data;
            error = retry.error;
        }

        if (error) {
            logger.error({ action: 'create', entity: 'expenses', error }, 'crud');
            throw error;
        }
        logger.info({ action: 'create', entity: 'expenses', id: data?.id }, 'crud');
        return data;
    },

    async update(id: string, updates: Partial<Expense>) {
        const { data, error } = await supabase
            .from('expenses')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error({ action: 'update', entity: 'expenses', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'update', entity: 'expenses', id, fields: Object.keys(updates || {}) }, 'crud');
        return data;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error({ action: 'delete', entity: 'expenses', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'delete', entity: 'expenses', id }, 'crud');
    },

    async getCategories() {
        const { data, error } = await supabase
            .from('expense_categories')
            .select('*')
            .order('name');

        if (error) {
            logger.error({ action: 'read', entity: 'expense_categories', error }, 'crud');
            throw error;
        }
        return data as ExpenseCategory[];
    },

    async createCategory(category: Omit<ExpenseCategory, 'id'>) {
        const { data: { user } } = await supabase.auth.getUser();

        const payload = {
            ...category,
            user_id: user?.id
        };

        const { data, error } = await supabase
            .from('expense_categories')
            .insert([payload])
            .select()
            .single();

        if (error) {
            logger.error({ action: 'create', entity: 'expense_categories', error }, 'crud');
            throw error;
        }
        logger.info({ action: 'create', entity: 'expense_categories', id: data?.id }, 'crud');
        return data;
    },

    async updateCategory(id: string, updates: Partial<ExpenseCategory>) {
        const { data, error } = await supabase
            .from('expense_categories')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error({ action: 'update', entity: 'expense_categories', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'update', entity: 'expense_categories', id, fields: Object.keys(updates || {}) }, 'crud');
        return data;
    },

    async deleteCategory(id: string) {
        const { error } = await supabase
            .from('expense_categories')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error({ action: 'delete', entity: 'expense_categories', id, error }, 'crud');
            throw error;
        }
        logger.info({ action: 'delete', entity: 'expense_categories', id }, 'crud');
    }
};
