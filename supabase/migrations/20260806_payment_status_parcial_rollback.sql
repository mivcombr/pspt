-- Rollback de 20260806_payment_status_parcial.sql
-- Volta os 'Parcial' para 'Pendente' antes de restaurar a restrição antiga.
UPDATE public.appointments
SET payment_status = 'Pendente'
WHERE payment_status = 'Parcial';

ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS appointments_payment_status_check;

ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_payment_status_check
    CHECK (payment_status = ANY (ARRAY['Pago'::text, 'Pendente'::text, 'Não realizado'::text]));
