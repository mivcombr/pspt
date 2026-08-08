-- Padroniza os nomes de catálogo que hoje divergem só por caixa, e impede que
-- a divergência volte.
--
-- Origem do problema: formas de pagamento e procedimentos são texto livre, e o
-- nome é COPIADO para o atendimento/pagamento no momento do lançamento. Um
-- hospital cadastrado com grafia diferente contamina tudo que se lança nele.
--   * Instituto de Oftalmologia Marco Rey (cadastrado em 07/05/2026):
--     "Cartão de Crédito" e "Transferência Bancária"
--   * Hospital Monte Claro: "Yag Laser (2 olhos)"
--
-- A grafia mantida é a majoritária, usada pelos demais hospitais.

-- Backup genérico: uma linha por valor alterado, o suficiente para o rollback.
CREATE TABLE IF NOT EXISTS public.catalog_name_backup_20260807 (
    id bigserial PRIMARY KEY,
    tabela text NOT NULL,
    registro_id uuid NOT NULL,
    coluna text NOT NULL,
    valor_antigo text,
    backed_up_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- pagamentos
INSERT INTO public.catalog_name_backup_20260807 (tabela, registro_id, coluna, valor_antigo)
SELECT 'hospital_payment_methods', id, 'name', name
FROM public.hospital_payment_methods
WHERE name IN ('Cartão de Crédito', 'Transferência Bancária');

UPDATE public.hospital_payment_methods
SET name = CASE name
        WHEN 'Cartão de Crédito' THEN 'Cartão de crédito'
        WHEN 'Transferência Bancária' THEN 'Transferência bancária'
    END
WHERE name IN ('Cartão de Crédito', 'Transferência Bancária');

INSERT INTO public.catalog_name_backup_20260807 (tabela, registro_id, coluna, valor_antigo)
SELECT 'appointment_payments', id, 'method', method
FROM public.appointment_payments
WHERE method IN ('Cartão de Crédito', 'Transferência Bancária');

UPDATE public.appointment_payments
SET method = CASE method
        WHEN 'Cartão de Crédito' THEN 'Cartão de crédito'
        WHEN 'Transferência Bancária' THEN 'Transferência bancária'
    END
WHERE method IN ('Cartão de Crédito', 'Transferência Bancária');

INSERT INTO public.catalog_name_backup_20260807 (tabela, registro_id, coluna, valor_antigo)
SELECT 'appointments', id, 'payment_method', payment_method
FROM public.appointments
WHERE payment_method IN ('Cartão de Crédito', 'Transferência Bancária');

UPDATE public.appointments
SET payment_method = CASE payment_method
        WHEN 'Cartão de Crédito' THEN 'Cartão de crédito'
        WHEN 'Transferência Bancária' THEN 'Transferência bancária'
    END
WHERE payment_method IN ('Cartão de Crédito', 'Transferência Bancária');

-- ------------------------------------------------------------- procedimentos
-- Atendimento e procedimento casam por NOME, então as duas tabelas precisam ser
-- atualizadas juntas — mexer só numa quebraria o vínculo dos 59 atendimentos.
INSERT INTO public.catalog_name_backup_20260807 (tabela, registro_id, coluna, valor_antigo)
SELECT 'procedures_price_list', id, 'name', name
FROM public.procedures_price_list
WHERE name = 'Yag Laser (2 olhos)';

UPDATE public.procedures_price_list
SET name = 'YAG Laser (2 Olhos)'
WHERE name = 'Yag Laser (2 olhos)';

INSERT INTO public.catalog_name_backup_20260807 (tabela, registro_id, coluna, valor_antigo)
SELECT 'appointments', id, 'procedure', procedure
FROM public.appointments
WHERE procedure = 'Yag Laser (2 olhos)';

UPDATE public.appointments
SET procedure = 'YAG Laser (2 Olhos)'
WHERE procedure = 'Yag Laser (2 olhos)';

-- ------------------------------------------------- cadastro do Parnamirim
-- Só tinha Dinheiro e Cartão. As duas formas faltantes existem em todos os
-- outros parceiros, sempre com repasse automático desligado.
INSERT INTO public.hospital_payment_methods (hospital_id, name, is_automatic_repasse)
SELECT h.id, v.name, false
FROM public.hospitals h
CROSS JOIN (VALUES ('PIX'), ('Transferência bancária')) AS v(name)
WHERE h.name = 'Centro da Visão Parnamirim'
  AND NOT EXISTS (
      SELECT 1 FROM public.hospital_payment_methods m
      WHERE m.hospital_id = h.id AND lower(btrim(m.name)) = lower(btrim(v.name))
  );

-- ------------------------------------------------------------------- trava
-- Impede duas formas com o mesmo nome no mesmo hospital, mesmo divergindo por
-- caixa ou espaço nas pontas.
CREATE UNIQUE INDEX IF NOT EXISTS hospital_payment_methods_hospital_name_key
    ON public.hospital_payment_methods (hospital_id, lower(btrim(name)));
