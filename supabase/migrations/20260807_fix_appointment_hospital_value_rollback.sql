-- Rollback de 20260807_fix_appointment_hospital_value.sql
-- Restaura hospital_value e net_value exatamente como estavam, a partir do backup.
UPDATE public.appointments a
SET hospital_value = b.hospital_value_old,
    net_value = b.net_value_old
FROM public.appointments_hospital_value_backup_20260807 b
WHERE b.appointment_id = a.id;

-- A tabela de backup é preservada de propósito. Só remova depois de confirmar
-- que a correção está validada e o rollback não será mais necessário:
-- DROP TABLE public.appointments_hospital_value_backup_20260807;
