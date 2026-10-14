-- Pedidos recebidos do iFood (módulo Order): vendas feitas no app do iFood que
-- a loja confirma, cancela e despacha pela cozinha do goak. Ficam fora da
-- tabela `pedidos` (que é só das vendas do próprio goak) — ver utils/ifood-pedidos.ts.
-- Migration aditiva: não altera nem remove nada existente.

create table if not exists public.pedidos_ifood (
  ifood_order_id text primary key,
  restaurante_id uuid not null references public.restaurantes(id) on delete cascade,
  display_id text,
  -- Último evento de status: PLACED, CONFIRMED, PREPARATION_STARTED,
  -- READY_TO_PICKUP, DISPATCHED, CONCLUDED, CANCELLED (ou CANCELLATION_REQUESTED
  -- enquanto o iFood não responde ao pedido de cancelamento da loja).
  status text not null default 'PLACED',
  ultimo_evento text,
  tipo text,                -- DELIVERY | TAKEOUT | INDOOR
  entrega_por text,         -- IFOOD | MERCHANT
  cliente_nome text,
  total numeric(10, 2),
  detalhes jsonb,           -- resposta de GET /order/v1.0/orders/{id}
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists pedidos_ifood_restaurante_idx
  on public.pedidos_ifood (restaurante_id, criado_em desc);

-- Só o service role acessa (o app usa createWebhookAdminClient).
alter table public.pedidos_ifood enable row level security;

revoke all on table public.pedidos_ifood from anon, authenticated;
grant all on table public.pedidos_ifood to service_role;
