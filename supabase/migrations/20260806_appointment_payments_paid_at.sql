-- Data em que cada pagamento foi efetivamente recebido.
-- Antes disso o sistema só sabia a data do procedimento, o que impedia
-- registrar pagamento antecipado (ex.: paciente paga os dois olhos em julho
-- e opera o segundo olho em agosto).
ALTER TABLE public.appointment_payments
    ADD COLUMN IF NOT EXISTS paid_at DATE;

-- Backfill: usa a data de quitação do atendimento quando existir,
-- senão a data do procedimento.
UPDATE public.appointment_payments p
SET paid_at = COALESCE((a.payment_paid_at AT TIME ZONE 'America/Recife')::date, a.date)
FROM public.appointments a
WHERE p.appointment_id = a.id
  AND p.paid_at IS NULL;

-- Pagamentos sem atendimento vinculado caem na data de criação do registro.
UPDATE public.appointment_payments
SET paid_at = (created_at AT TIME ZONE 'America/Recife')::date
WHERE paid_at IS NULL;

-- Backfill do nível do atendimento: quem já está 'Pago' mas nunca teve a data
-- carimbada passa a usar o pagamento mais recente (ou a data do procedimento).
UPDATE public.appointments a
SET payment_paid_at = COALESCE(
        (SELECT MAX(p.paid_at) FROM public.appointment_payments p WHERE p.appointment_id = a.id),
        a.date
    )::timestamp AT TIME ZONE 'America/Recife'
WHERE a.payment_status = 'Pago'
  AND a.payment_paid_at IS NULL;

-- Índices para o filtro de período em regime de caixa (tela Financeiro).
CREATE INDEX IF NOT EXISTS idx_appointment_payments_paid_at
    ON public.appointment_payments (paid_at);

CREATE INDEX IF NOT EXISTS idx_appointments_payment_paid_at
    ON public.appointments (payment_paid_at);
