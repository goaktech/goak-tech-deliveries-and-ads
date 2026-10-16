-- WhatsApp: cenários 2, 3 e 4 (aviso interno de venda, remetente único Appetitoso,
-- gancho para número próprio da loja). Migration aditiva; só o servidor (service_role) usa as tabelas novas.

-- Cenário 4: flag por loja. Enquanto false, a loja usa o número do Appetitoso.
ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS whatsapp_proprio_liberado boolean NOT NULL DEFAULT false;

-- Cenário 3: acompanhar o ciclo de vida da mensagem (sent/delivered/read/failed) via webhook da Meta.
ALTER TABLE public.notificacoes_pedido
  ADD COLUMN IF NOT EXISTS entrega_status text,
  ADD COLUMN IF NOT EXISTS entrega_status_em timestamptz;

CREATE INDEX IF NOT EXISTS notificacoes_pedido_provider_msg_idx
  ON public.notificacoes_pedido (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- Cenário 2: quem recebe o aviso interno de venda.
-- restaurante_id NULL = equipe Appetitoso (recebe de todas as lojas);
-- restaurante_id preenchido = dono/responsável daquela loja.
CREATE TABLE IF NOT EXISTS public.whatsapp_destinatarios_aviso (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id uuid        REFERENCES public.restaurantes(id) ON DELETE CASCADE,
  nome           text        NOT NULL,
  telefone       text        NOT NULL, -- formato internacional só com dígitos (ex.: 5561999999999)
  papel          text        NOT NULL DEFAULT 'loja', -- loja | plataforma
  ativo          boolean     NOT NULL DEFAULT true,
  consentimento_em timestamptz,        -- quando a pessoa concordou em receber os avisos
  criado_em      timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT whatsapp_destinatarios_papel_chk CHECK (papel IN ('loja', 'plataforma')),
  CONSTRAINT whatsapp_destinatarios_telefone_chk CHECK (telefone ~ '^[0-9]{12,13}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_destinatarios_unico_idx
  ON public.whatsapp_destinatarios_aviso (coalesce(restaurante_id, '00000000-0000-0000-0000-000000000000'::uuid), telefone);

-- Registro por pedido + destinatário: garante envio único e guarda o resultado.
CREATE TABLE IF NOT EXISTS public.avisos_venda_whatsapp (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id           uuid        NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  destinatario_id     uuid        NOT NULL REFERENCES public.whatsapp_destinatarios_aviso(id) ON DELETE CASCADE,
  sucesso             boolean     NOT NULL DEFAULT false,
  provider_message_id text,
  entrega_status      text,
  entrega_status_em   timestamptz,
  erro_json           jsonb,
  criado_em           timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (pedido_id, destinatario_id)
);

CREATE INDEX IF NOT EXISTS avisos_venda_whatsapp_msg_idx
  ON public.avisos_venda_whatsapp (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.whatsapp_destinatarios_aviso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avisos_venda_whatsapp ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_destinatarios_aviso FROM anon, authenticated;
REVOKE ALL ON TABLE public.avisos_venda_whatsapp FROM anon, authenticated;
GRANT ALL ON TABLE public.whatsapp_destinatarios_aviso TO service_role;
GRANT ALL ON TABLE public.avisos_venda_whatsapp TO service_role;
