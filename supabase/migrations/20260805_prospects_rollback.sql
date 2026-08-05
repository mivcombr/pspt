-- Rollback de 20260805_prospects.sql
--
-- ATENÇÃO: remove as tabelas de prospecção e todos os dados nelas.
-- Como a migration original é aditiva, este rollback não restaura nada —
-- apenas volta o banco ao estado anterior à criação do kanban.

DROP TABLE IF EXISTS public.prospect_activities;
DROP TABLE IF EXISTS public.prospects;
