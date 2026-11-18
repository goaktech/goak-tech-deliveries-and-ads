-- WhatsApp, cenário 5: conversas no número do Appetitoso (18-11-2026).
-- O webhook grava toda mensagem recebida e toda resposta enviada pelo painel. Cada conversa vai para a
-- loja do último pedido daquele cliente (até 60 dias); sem pedido, fica na caixa da equipe Appetitoso.
-- Só o servidor (service_role) usa as tabelas: RLS ligado, sem políticas.

CREATE TABLE IF NOT EXISTS public.whatsapp_mensagens (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  wamid           text        NOT NULL UNIQUE,              -- id da mensagem na Meta
  direcao         text        NOT NULL,                     -- entrada (cliente) | saida (resposta pelo painel)
  phone_number_id text,                                     -- número do Appetitoso que recebeu/enviou
  telefone        text        NOT NULL,                     -- wa_id do cliente, só dígitos (ex.: 556199999999)
  chave_telefone  text        NOT NULL,                     -- DDD + 8 últimos dígitos (casa com ou sem o 9)
  nome_contato    text,                                     -- nome do perfil no WhatsApp
  tipo            text        NOT NULL DEFAULT 'text',      -- text, image, audio, button, interactive...
  texto           text,
  restaurante_id  uuid        REFERENCES public.restaurantes(id) ON DELETE SET NULL,
  pedido_id       uuid        REFERENCES public.pedidos(id) ON DELETE SET NULL,
  anuncio_id      text,                                     -- referral.source_id (anúncio de clique para o WhatsApp)
  anuncio_json    jsonb,
  status          text,                                     -- saída: sent | delivered | read | failed
  erro_json       jsonb,
  enviado_por     uuid,                                     -- auth.users.id de quem respondeu pelo painel
  ocorrido_em     timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  criado_em       timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT whatsapp_mensagens_direcao_chk CHECK (direcao IN ('entrada', 'saida'))
);

CREATE INDEX IF NOT EXISTS whatsapp_mensagens_restaurante_idx ON public.whatsapp_mensagens (restaurante_id, ocorrido_em DESC);
CREATE INDEX IF NOT EXISTS whatsapp_mensagens_chave_idx ON public.whatsapp_mensagens (chave_telefone, ocorrido_em DESC);

-- Payload bruto de cada chamada do webhook (diagnóstico). O erro do processamento fica em "erro".
CREATE TABLE IF NOT EXISTS public.whatsapp_eventos (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campo      text,                                          -- messages, account_update...
  payload    jsonb       NOT NULL,
  erro       text,
  criado_em  timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS whatsapp_eventos_criado_idx ON public.whatsapp_eventos (criado_em DESC);

ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_mensagens FROM anon, authenticated;
REVOKE ALL ON public.whatsapp_eventos FROM anon, authenticated;
GRANT ALL ON TABLE public.whatsapp_mensagens TO service_role;
GRANT ALL ON TABLE public.whatsapp_eventos TO service_role;

-- Loja e pedido mais recentes do cliente com este telefone (DDD + 8 últimos dígitos), nos últimos 60 dias.
CREATE OR REPLACE FUNCTION public.whatsapp_rotear_conversa(p_chave text)
RETURNS TABLE (restaurante_id uuid, pedido_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH pedidos_recentes AS (
    SELECT p.restaurante_id, p.id, p.created_at,
           regexp_replace(coalesce(p.dados_cliente->>'telefone', ''), '\D', '', 'g') AS digitos
    FROM public.pedidos p
    WHERE p.created_at > now() - interval '60 days'
  ),
  normalizados AS (
    SELECT restaurante_id, id, created_at,
           CASE WHEN length(digitos) > 11 AND left(digitos, 2) = '55' THEN substr(digitos, 3) ELSE digitos END AS local
    FROM pedidos_recentes
  )
  SELECT restaurante_id, id
  FROM normalizados
  WHERE length(local) >= 10 AND left(local, 2) || right(local, 8) = p_chave
  ORDER BY created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_rotear_conversa(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_rotear_conversa(text) TO service_role;
