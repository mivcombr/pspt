-- Rollback de 20260808_debit_card_payment_method.sql
-- Remove o "Cartão de débito" apenas onde ninguém tiver lançado pagamento com
-- ele — se já foi usado, a forma precisa continuar existindo.
DELETE FROM public.hospital_payment_methods m
WHERE lower(btrim(m.name)) = 'cartão de débito'
  AND NOT EXISTS (
      SELECT 1
      FROM public.appointment_payments p
      JOIN public.appointments a ON a.id = p.appointment_id
      WHERE a.hospital_id = m.hospital_id
        AND lower(btrim(p.method)) = lower(btrim(m.name))
  );
