-- Rollback de 20260807_procedure_hospital_value.sql
-- Remove a coluna de valor fixo do hospital na tabela de preços. Os atendimentos
-- já gravados mantêm seu appointments.hospital_value — nada em appointments é tocado.
ALTER TABLE public.procedures_price_list
    DROP COLUMN IF EXISTS hospital_value;
