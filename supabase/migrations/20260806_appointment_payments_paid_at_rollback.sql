-- Rollback de 20260806_appointment_payments_paid_at.sql
-- Atenção: o backfill de appointments.payment_paid_at não é revertido
-- (não há como distinguir o que foi preenchido pela migração).
DROP INDEX IF EXISTS public.idx_appointments_payment_paid_at;
DROP INDEX IF EXISTS public.idx_appointment_payments_paid_at;

ALTER TABLE public.appointment_payments
    DROP COLUMN IF EXISTS paid_at;
