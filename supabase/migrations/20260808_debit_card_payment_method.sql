-- Cadastra "Cartão de débito" em todos os parceiros.
--
-- O valor do atendimento passou a ser derivado da forma de pagamento: só o
-- crédito usa o preço de cartão, porque é ele que embute a taxa da maquineta.
-- Sem o débito cadastrado, a recepção lançaria débito como crédito e o sistema
-- cobraria o preço de cartão indevidamente.
--
-- A grafia acompanha a canônica já usada ("Cartão de crédito", com d minúsculo).
-- O NOT EXISTS respeita o índice único por hospital sobre o nome normalizado,
-- então rodar de novo não duplica nada.
INSERT INTO public.hospital_payment_methods (hospital_id, name, is_automatic_repasse)
SELECT h.id, 'Cartão de débito', false
FROM public.hospitals h
WHERE NOT EXISTS (
    SELECT 1 FROM public.hospital_payment_methods m
    WHERE m.hospital_id = h.id
      AND lower(btrim(m.name)) = 'cartão de débito'
);
