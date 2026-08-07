-- Corrige o valor do hospital nos atendimentos passados em que a regra antiga
-- (hospital = total cobrado − valor do programa) inflou a parte do hospital.
--
-- Escopo deliberadamente estreito — só entram atendimentos que satisfazem TUDO:
--   1. venda no cartão (total cobrado acima do preço à vista);
--   2. hospital gravado acima do valor fixo da tabela de preços.
--
-- Ficam de fora, por decisão do usuário / por exigirem decisão de negócio:
--   * os que já foram ajustados manualmente no Financeiro (já batem com o fixo);
--   * atendimentos com desconto (cobrado <= preço à vista) e hospital acima do
--     fixo — aí a pergunta é quem absorve o desconto, hospital ou programa;
--   * atendimentos com hospital ABAIXO do fixo, que podem ser acordo específico.

-- Backup dos valores originais. A tabela é a fonte do rollback e fica no banco.
CREATE TABLE IF NOT EXISTS public.appointments_hospital_value_backup_20260807 (
    appointment_id uuid PRIMARY KEY,
    hospital_value_old numeric,
    net_value_old numeric,
    backed_up_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.appointments_hospital_value_backup_20260807 (appointment_id, hospital_value_old, net_value_old)
SELECT a.id, a.hospital_value, a.net_value
FROM public.appointments a
JOIN public.procedures_price_list p
  ON p.hospital_id = a.hospital_id
 AND p.name = a.procedure
 AND upper(p.type) = upper(a.type)
WHERE a.total_cost > p.cash_price + 0.005
  AND a.hospital_value > p.hospital_value + 0.005
ON CONFLICT (appointment_id) DO NOTHING;

-- Hospital passa a valer o fixo da tabela. O excedente deixa de ser dele e vira
-- valor a conciliar; net_value acompanha para não ficar inconsistente.
UPDATE public.appointments a
SET hospital_value = p.hospital_value,
    net_value = p.hospital_value + COALESCE(a.repasse_value, 0) + COALESCE(a.financial_additional, 0)
FROM public.procedures_price_list p
WHERE p.hospital_id = a.hospital_id
  AND p.name = a.procedure
  AND upper(p.type) = upper(a.type)
  AND a.total_cost > p.cash_price + 0.005
  AND a.hospital_value > p.hospital_value + 0.005;
