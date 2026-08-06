-- Novo status 'Parcial': o paciente pagou parte do valor e ainda deve o saldo.
-- Antes esses casos ficavam como 'Pendente', indistinguíveis de quem não pagou nada.
ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS appointments_payment_status_check;

ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_payment_status_check
    CHECK (payment_status = ANY (ARRAY['Pago'::text, 'Parcial'::text, 'Pendente'::text, 'Não realizado'::text]));

-- Backfill: quem tem pagamento lançado mas não quitou vira 'Parcial'.
UPDATE public.appointments a
SET payment_status = 'Parcial'
WHERE a.payment_status = 'Pendente'
  AND COALESCE((
        SELECT SUM(p.value) FROM public.appointment_payments p WHERE p.appointment_id = a.id
    ), 0) > 0.005
  AND COALESCE((
        SELECT SUM(p.value) FROM public.appointment_payments p WHERE p.appointment_id = a.id
    ), 0) < COALESCE(a.total_cost, 0) - 0.005;
