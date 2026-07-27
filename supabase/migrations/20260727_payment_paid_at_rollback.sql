-- Rollback de 20260727_payment_paid_at.sql
ALTER TABLE public.appointments
    DROP COLUMN IF EXISTS payment_paid_at;
