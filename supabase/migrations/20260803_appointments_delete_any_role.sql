-- Permite que qualquer usuário exclua agendamentos do seu hospital.
--
-- Antes, a política de DELETE em appointments só permitia ADMIN/SUPER_ADMIN.
-- Para os demais papéis o DELETE não retornava erro — apenas afetava 0 linhas —
-- e o agendamento "voltava" para a tela após o refetch.
--
-- A nova política espelha a política de UPDATE já existente:
-- admin-like (ADMIN/SUPER_ADMIN/COMMERCIAL) exclui qualquer agendamento;
-- RECEPTION e FINANCIAL excluem apenas agendamentos do próprio hospital.
--
-- Rollback: 20260803_appointments_delete_any_role_rollback.sql

DROP POLICY IF EXISTS appointments_delete ON public.appointments;

CREATE POLICY appointments_delete ON public.appointments
  FOR DELETE
  USING (
    public.is_admin_like()
    OR (public.get_my_role() = 'RECEPTION' AND hospital_id = public.get_my_hospital_id())
    OR (public.get_my_role() = 'FINANCIAL' AND hospital_id = public.get_my_hospital_id())
  );
