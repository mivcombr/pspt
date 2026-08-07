-- Valor fixo que o hospital recebe por procedimento.
--
-- Até aqui o valor do hospital era derivado: total cobrado − valor do programa.
-- Isso quebra na venda em cartão, onde o total cobrado embute a taxa da maquineta
-- e o adicional: todo esse excedente ia parar no hospital.
--
-- A regra correta é: hospital e programa recebem valores fixos, e o que passar
-- disso é excedente a conciliar (taxa + adicional do programa).
ALTER TABLE public.procedures_price_list
    ADD COLUMN IF NOT EXISTS hospital_value numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.procedures_price_list.hospital_value IS
    'Valor fixo repassado ao hospital por procedimento, independente da forma de pagamento.';

-- Seed com o valor implícito de hoje (preço à vista − valor do programa), que é
-- exatamente o que o hospital já recebe nas vendas à vista. Serve como ponto de
-- partida: cada hospital pode ser ajustado na tela de Tabela de Preços.
UPDATE public.procedures_price_list
SET hospital_value = GREATEST(COALESCE(cash_price, 0) - COALESCE(repasse_value, 0), 0)
WHERE hospital_value = 0;
