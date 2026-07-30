-- Restaura as policies de SELECT anteriores a 20260730_commercial_select_hospital_data.sql
-- (COMMERCIAL volta a não enxergar formas de pagamento/bloqueios de outras unidades).

ALTER POLICY hospital_payment_methods_select ON public.hospital_payment_methods
  USING (public.get_my_role() = 'ADMIN' OR hospital_id = public.get_my_hospital_id());

ALTER POLICY schedule_blocks_select ON public.schedule_blocks
  USING (public.get_my_role() = 'ADMIN' OR hospital_id = public.get_my_hospital_id());
