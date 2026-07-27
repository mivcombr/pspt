-- Adiciona a data em que o pagamento foi recebido (equivalente ao repasse_paid_at do acerto).
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMP WITH TIME ZONE;

-- Backfill: para registros já pagos, usa a data da primeira mudança de payment_status
-- para 'Pago' registrada nos audit logs (quando disponível).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'appointment_audit_logs'
    ) THEN
        UPDATE public.appointments a
        SET payment_paid_at = logs.first_paid_at
        FROM (
            SELECT appointment_id, MIN(changed_at) AS first_paid_at
            FROM public.appointment_audit_logs
            WHERE changes -> 'payment_status' ->> 'to' = 'Pago'
            GROUP BY appointment_id
        ) logs
        WHERE a.id = logs.appointment_id
          AND a.payment_status = 'Pago'
          AND a.payment_paid_at IS NULL;
    END IF;
END $$;
