-- O usuário COMMERCIAL passou a agendar em qualquer unidade (71f8862), mas as
-- policies de SELECT de hospital_payment_methods e schedule_blocks só liberavam
-- ADMIN ou usuário da própria unidade — no novo agendamento, o select de forma
-- de pagamento vinha vazio e os bloqueios de agenda não apareciam.
-- Escrita permanece restrita a ADMIN. Rollback: 20260730_commercial_select_hospital_data_rollback.sql

ALTER POLICY hospital_payment_methods_select ON public.hospital_payment_methods
  USING (public.is_admin_like() OR hospital_id = public.get_my_hospital_id());

ALTER POLICY schedule_blocks_select ON public.schedule_blocks
  USING (public.is_admin_like() OR hospital_id = public.get_my_hospital_id());
