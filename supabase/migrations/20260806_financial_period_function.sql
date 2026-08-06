-- Conjunto de atendimentos que compõem o Financeiro de um período em regime de
-- caixa, incluindo pagamentos parciais:
--   1. quem recebeu qualquer valor dentro do período (pela data do pagamento);
--   2. quem ainda tem saldo em aberto e teve o procedimento no período.
-- Um atendimento pago parcialmente em julho e concluído em agosto aparece nos
-- dois períodos — em cada um com a parcela que lhe cabe (rateio feito no app).
--
-- SECURITY INVOKER (padrão): a RLS de appointments/appointment_payments continua
-- valendo normalmente para quem chama.
CREATE OR REPLACE FUNCTION public.appointments_financial_period(
    p_start date,
    p_end date
)
RETURNS SETOF public.appointments
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT a.*
    FROM public.appointments a
    WHERE EXISTS (
            SELECT 1
            FROM public.appointment_payments p
            WHERE p.appointment_id = a.id
              AND COALESCE(p.paid_at, a.date) BETWEEN p_start AND p_end
        )
       OR (
            a.date BETWEEN p_start AND p_end
            AND COALESCE((
                    SELECT SUM(p.value)
                    FROM public.appointment_payments p
                    WHERE p.appointment_id = a.id
                ), 0) < COALESCE(a.total_cost, 0) - 0.005
        )
       OR (
            -- Atendimentos sem nenhum pagamento lançado (inclui 'Não realizado'
            -- e registros de valor zero) entram pela data do procedimento.
            a.date BETWEEN p_start AND p_end
            AND NOT EXISTS (
                SELECT 1 FROM public.appointment_payments p WHERE p.appointment_id = a.id
            )
        );
$$;

GRANT EXECUTE ON FUNCTION public.appointments_financial_period(date, date) TO authenticated;
