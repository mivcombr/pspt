import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export interface Procedure {
    id: string;
    name: string;
    standard_price: number;
    cash_price: number;
    /** Valor fixo do programa por procedimento. */
    repasse_value: number;
    /** Valor fixo do hospital, independente da forma de pagamento. */
    hospital_value: number;
    type: 'Consulta' | 'Exame' | 'Cirurgia';
    hospital_id?: string;
}

/**
 * Procedimento coringa: é o único em que o valor é digitado, porque cobre o que
 * não está na tabela. Todo o resto usa um dos dois preços cadastrados — foi o
 * campo de valor livre que deixou atendimentos gravados com preço de outro
 * procedimento, e a divisão hospital/programa sem relação com o que foi pago.
 */
export const FREE_PRICE_PROCEDURE = 'Outros';

/**
 * Modalidade de preço. Não é escolha de quem atende: decorre da forma de
 * pagamento. Crédito usa o preço de cartão em qualquer número de parcelas,
 * inclusive 1x; dinheiro, PIX, débito e transferência usam o à vista.
 */
export type PriceMode = 'avista' | 'cartao';

/** Preço cadastrado para a modalidade. `standard_price` é o preço de cartão. */
export const priceForMode = (proc: Pick<Procedure, 'cash_price' | 'standard_price'> | undefined | null, mode: PriceMode) =>
    Number(mode === 'cartao' ? proc?.standard_price : proc?.cash_price) || 0;

export const PRICE_MODE_LABEL: Record<PriceMode, string> = {
    avista: 'À vista',
    cartao: 'Cartão'
};

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
