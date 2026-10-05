-- supabase-scripts/ifood-entrega-pedidos.sql
-- "Chamar motoboy iFood" no card da cozinha (parte 2 da integração iFood Entrega).
-- Rodar depois de supabase-scripts/ifood-entrega-integracao.sql.

-- Logística iFood no pedido. logistica = 'IFOOD' enquanto a entrega estiver
-- com o iFood; volta a NULL se o iFood cancelar (libera o motoboy próprio).
alter table public.pedidos
  add column if not exists logistica text,
  add column if not exists ifood_order_id text,
  add column if not exists ifood_tracking_url text,
  add column if not exists ifood_status text,
  add column if not exists ifood_cotacao jsonb,
  add column if not exists ifood_entregador jsonb,
  add column if not exists ifood_alteracao_endereco jsonb,
  add column if not exists ifood_codigo_entrega text,
  add column if not exists ifood_atualizado_em timestamptz;

create unique index if not exists pedidos_ifood_order_id_idx
  on public.pedidos (ifood_order_id)
  where ifood_order_id is not null;

-- Eventos recebidos do iFood (polling). A chave primária no event_id é a
-- deduplicação exigida pela homologação: evento repetido é descartado.
create table if not exists public.eventos_ifood (
  event_id text primary key,
  restaurante_id uuid references public.restaurantes(id) on delete cascade,
  ifood_order_id text,
  pedido_id uuid references public.pedidos(id) on delete set null,
  codigo text,
  payload jsonb,
  recebido_em timestamptz not null default now()
);

create index if not exists eventos_ifood_pedido_idx on public.eventos_ifood (pedido_id);

-- Só o service role acessa (o app usa createWebhookAdminClient).
alter table public.eventos_ifood enable row level security;
