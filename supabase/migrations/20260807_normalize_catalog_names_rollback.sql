-- Rollback de 20260807_normalize_catalog_names.sql
-- Restaura cada nome a partir do backup e desfaz a trava e os cadastros novos.

DROP INDEX IF EXISTS public.hospital_payment_methods_hospital_name_key;

-- As formas criadas para o Parnamirim não estão no backup (eram inserções, não
-- alterações). Só são removidas se ninguém tiver usado ainda.
DELETE FROM public.hospital_payment_methods m
USING public.hospitals h
WHERE m.hospital_id = h.id
  AND h.name = 'Centro da Visão Parnamirim'
  AND m.name IN ('PIX', 'Transferência bancária')
  AND NOT EXISTS (
      SELECT 1
      FROM public.appointment_payments p
      JOIN public.appointments a ON a.id = p.appointment_id
      WHERE a.hospital_id = m.hospital_id
        AND lower(btrim(p.method)) = lower(btrim(m.name))
  );

UPDATE public.hospital_payment_methods t
SET name = b.valor_antigo
FROM public.catalog_name_backup_20260807 b
WHERE b.tabela = 'hospital_payment_methods' AND b.coluna = 'name' AND b.registro_id = t.id;

UPDATE public.appointment_payments t
SET method = b.valor_antigo
FROM public.catalog_name_backup_20260807 b
WHERE b.tabela = 'appointment_payments' AND b.coluna = 'method' AND b.registro_id = t.id;

UPDATE public.appointments t
SET payment_method = b.valor_antigo
FROM public.catalog_name_backup_20260807 b
WHERE b.tabela = 'appointments' AND b.coluna = 'payment_method' AND b.registro_id = t.id;

UPDATE public.procedures_price_list t
SET name = b.valor_antigo
FROM public.catalog_name_backup_20260807 b
WHERE b.tabela = 'procedures_price_list' AND b.coluna = 'name' AND b.registro_id = t.id;

UPDATE public.appointments t
SET procedure = b.valor_antigo
FROM public.catalog_name_backup_20260807 b
WHERE b.tabela = 'appointments' AND b.coluna = 'procedure' AND b.registro_id = t.id;

-- Tabela de backup preservada de propósito. Remova só depois de validar:
-- DROP TABLE public.catalog_name_backup_20260807;
