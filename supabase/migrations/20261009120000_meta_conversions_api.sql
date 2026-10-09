-- API de Conversões da Meta (PR B)
-- 1) Token por loja, em tabela própria: só o servidor (service_role) lê ou grava.
-- 2) Pedidos: IP e navegador do cliente (para o match do evento) e marca de envio (idempotência).
-- Migration aditiva: não altera nem remove nada existente.

CREATE TABLE IF NOT EXISTS public.restaurante_integracoes_meta_capi (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id   uuid        NOT NULL UNIQUE REFERENCES public.restaurantes(id) ON DELETE CASCADE,
  access_token     text        NOT NULL,
  test_event_code  text,
  created_at       timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at       timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.restaurante_integracoes_meta_capi ENABLE ROW LEVEL SECURITY;

-- Sem policies e sem grants para anon/authenticated: o token nunca chega ao navegador.
REVOKE ALL ON TABLE public.restaurante_integracoes_meta_capi FROM anon, authenticated;
GRANT ALL ON TABLE public.restaurante_integracoes_meta_capi TO service_role;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS fb_client_ip text,
  ADD COLUMN IF NOT EXISTS fb_user_agent text,
  ADD COLUMN IF NOT EXISTS capi_purchase_enviado_em timestamptz;
