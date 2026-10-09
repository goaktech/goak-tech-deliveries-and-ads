-- Histórico de preços do cardápio (checkout honra o preço que o cliente viu).
-- Cada vez que o gestor edita um produto, guardamos a versão ANTERIOR (preço e adicionais) com o
-- instante da troca. O checkout usa isso para cobrar o preço que o cliente viu na vitrine até o
-- fim do expediente do dia (CDC art. 30: a oferta vincula o fornecedor).
-- Migration aditiva: não altera nem remove nada existente. Só o servidor (service_role) lê e grava.

CREATE TABLE IF NOT EXISTS public.historico_precos_item (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id   uuid          NOT NULL REFERENCES public.restaurantes(id) ON DELETE CASCADE,
  item_cardapio_id uuid          NOT NULL REFERENCES public.itens_cardapio(id) ON DELETE CASCADE,
  preco_venda      numeric(12,2) NOT NULL,
  -- [{ "nome": "Bacon", "preco": 3.5 }, ...] da versão que deixou de valer
  adicionais       jsonb         NOT NULL DEFAULT '[]'::jsonb,
  substituido_em   timestamptz   NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_historico_precos_item_item_data
  ON public.historico_precos_item (item_cardapio_id, substituido_em DESC);

ALTER TABLE public.historico_precos_item ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.historico_precos_item FROM anon, authenticated;
GRANT ALL ON TABLE public.historico_precos_item TO service_role;
