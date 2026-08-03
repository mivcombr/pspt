-- Rollback de 20260803_appointments_delete_any_role.sql
-- Restaura a política original: apenas ADMIN/SUPER_ADMIN podem excluir agendamentos.

DROP POLICY IF EXISTS appointments_delete ON public.appointments;

CREATE POLICY appointments_delete ON public.appointments
  FOR DELETE
  USING (public.get_my_role() = ANY (ARRAY['ADMIN'::text, 'SUPER_ADMIN'::text]));
