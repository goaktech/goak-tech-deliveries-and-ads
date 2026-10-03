-- supabase-scripts/ifood-entrega-integracao.sql
-- Conexão de cada restaurante com a própria loja no iFood (app distribuído).
-- Rodar no SQL Editor do Supabase antes de usar o card "iFood Entrega" em
-- /admin/integracoes.
--
-- Guarda tokens de acesso do iFood: RLS ligado e SEM policies, então só o
-- service role (utils/supabase/webhook.ts) lê e grava esta tabela.

create table if not exists public.restaurante_integracoes_ifood (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null unique references public.restaurantes(id) on delete cascade,

  -- Loja no iFood (dados puxados de GET /merchant/v1.0/merchants/{id})
  merchant_id text,
  merchant_nome text,
  merchant_razao_social text,
  merchant_status text,
  merchant_endereco jsonb,
  dados_atualizados_em timestamptz,

  -- Tokens (accessToken ~6h, refreshToken renova o acesso)
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,

  -- Vínculo em andamento (userCode aguardando aprovação do lojista)
  authorization_code_verifier text,
  user_code text,
  verification_url text,
  user_code_expires_at timestamptz,

  connection_status text not null default 'pendente'
    check (connection_status in ('pendente', 'conectado', 'desconectado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.restaurante_integracoes_ifood enable row level security;

-- Uma loja iFood só pode estar conectada a um restaurante do goak por vez.
create unique index if not exists restaurante_integracoes_ifood_merchant_conectado_idx
  on public.restaurante_integracoes_ifood (merchant_id)
  where connection_status = 'conectado';
