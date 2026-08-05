-- Prospecção de parceiros (Kanban) — 2026-08-05
-- Rollback: 20260805_prospects_rollback.sql
--
-- Mudança puramente aditiva: cria duas tabelas novas (prospects e
-- prospect_activities) e suas policies. Nenhuma policy, função ou tabela
-- existente é alterada, portanto nenhum fluxo atual do app é afetado.
--
-- Acesso restrito a SUPER_ADMIN via public.is_super_admin(), espelhando o
-- modelo da página Controle de Acessos.

-- =====================================================================
-- 1. prospects — cards do kanban
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'novo'
        CHECK (stage IN ('novo', 'contato', 'reuniao', 'proposta', 'negociacao', 'fechado', 'perdido')),
    -- Ordem do card dentro da coluna (menor = mais acima).
    position INTEGER NOT NULL DEFAULT 0,
    segment TEXT,                 -- Hospital, Clínica, Laboratório, Consultório...
    contact_name TEXT,
    contact_role TEXT,
    phone TEXT,
    email TEXT,
    city TEXT,
    state TEXT,
    source TEXT,                  -- Indicação, Prospecção ativa, Evento, Inbound...
    priority TEXT NOT NULL DEFAULT 'Média'
        CHECK (priority IN ('Baixa', 'Média', 'Alta')),
    estimated_value NUMERIC(12, 2),
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    next_action TEXT,             -- Descrição do próximo passo
    next_action_at DATE,          -- Data do próximo passo
    notes TEXT,
    lost_reason TEXT,             -- Preenchido quando o card vai para "perdido"
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospects_stage_position ON public.prospects(stage, position);
CREATE INDEX IF NOT EXISTS idx_prospects_owner ON public.prospects(owner_id);
CREATE INDEX IF NOT EXISTS idx_prospects_next_action ON public.prospects(next_action_at);

DROP TRIGGER IF EXISTS set_prospects_updated_at ON public.prospects;
CREATE TRIGGER set_prospects_updated_at
    BEFORE UPDATE ON public.prospects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prospects_all ON public.prospects;
CREATE POLICY prospects_all ON public.prospects
    FOR ALL
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- =====================================================================
-- 2. prospect_activities — histórico de interações do card
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.prospect_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'nota'
        CHECK (type IN ('nota', 'ligacao', 'reuniao', 'email', 'whatsapp', 'estagio')),
    content TEXT NOT NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    -- Nome desnormalizado para o histórico sobreviver à exclusão do perfil.
    author_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_activities_prospect
    ON public.prospect_activities(prospect_id, created_at DESC);

ALTER TABLE public.prospect_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prospect_activities_all ON public.prospect_activities;
CREATE POLICY prospect_activities_all ON public.prospect_activities
    FOR ALL
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());
