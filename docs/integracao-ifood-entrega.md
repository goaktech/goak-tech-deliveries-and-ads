# Integração iFood Entrega (Shipping) — "Chamar motoboy iFood"

Análise de viabilidade — 02-10-2026

Referência validada: um PDV simulado em PHP (fora deste repositório) que exercitou a API real de Shipping na loja de teste do iFood — a tabela "Código novo" abaixo mapeia o que foi portado de lá.

## Resumo

**É viável e encaixa bem no que o goak já tem.** O sistema já geocodifica loja e cliente (`restaurantes.latitude/longitude`, `pedidos.cliente_latitude/longitude`), já tem esteira de status com notificações (`atualizarStatusPedidoComNotificacoes`), atribuição de motoboy no card da cozinha e o padrão "conectar integração" por loja (Mercado Pago, WhatsApp, Meta Ads). O iFood Entrega entra como **uma segunda opção de logística** ao lado do motoboy próprio, no mesmo seletor "Entregador" do card da cozinha.

## Decisão de arquitetura 1 — modelo de app: distribuído

O goak é SaaS multi-loja. Cada restaurante tem o próprio merchant no iFood, então o app de produção precisa ser **distribuído** (cada loja autoriza o goak a operar em seu nome), não centralizado.

- App de produção: **"PDV-goak"** (já existe no Developer Portal, Distribuído, "Em desenvolvimento"). É ele que deve ser homologado.
- Desenvolvimento: app de teste **"... - Teste (D)"** (distribuído, já com permissão na loja de teste, sem precisar de homologação). O "Teste (C)" (centralizado) foi usado só no PDV PHP.
- Fluxo de conexão por loja (igual ao "Conectar Mercado Pago", mas sem redirect): gestor clica "Conectar iFood" → goak gera `userCode` → gestor autoriza no Portal do Parceiro → cola o `authorizationCode` → goak troca por `accessToken` + `refreshToken` (3h / 168h) e salva por restaurante. Renovação automática via `grant_type=refresh_token`.

**Pré-requisito de negócio por loja:** o restaurante precisa ter cadastro no iFood com o iFood Entrega habilitado para pedidos de outros canais (senão a API devolve `MerchantEasyDeliveryDisabled` / `OriginNotFound`). O valor da entrega (`quote.netValue`) é cobrado da loja pelo iFood — precisa ficar claro na tela antes de chamar.

## Decisão de arquitetura 2 — recebimento de eventos: webhook

O goak roda serverless (Next.js), sem processo contínuo pra fazer polling a cada 30s.

- **Recomendado:** webhook do iFood → `POST /api/webhooks/ifood` (configurado na aba "Webhook" do app no Developer Portal), validando assinatura e deduplicando por `eventId` numa tabela — mesmo padrão de `eventos_webhook_stripe`.
- **Confirmar com o suporte** que webhook atende o critério "Gestão de eventos" da homologação de Shipping (a página de critérios cita polling explicitamente; a doc de eventos trata webhook como alternativa oficial).
- Plano B se exigirem polling: cron (Supabase `pg_cron` + Edge Function, ou worker) a cada 30s para os merchants conectados.

## Fluxo na operação

| Momento no goak | Ação iFood | Onde |
|---|---|---|
| Pedido de ENTREGA em `PREPARANDO`/`PRONTO` | "Chamar motoboy iFood" → `GET deliveryAvailabilities` (coords do cliente) mostra preço, distância e ETA | Card da cozinha, seletor "Entregador" |
| Gestor confirma | `POST /merchants/{id}/orders` com cliente, endereço, itens, `preparationTime` = tempo de preparo restante; pagamento online (PIX/MP) → sem `payments`; dinheiro/cartão na entrega → `OFFLINE` | idem |
| `ASSIGN_DRIVER` / `GOING_TO_ORIGIN` / `ARRIVED_AT_ORIGIN` | Mostra "motoboy iFood a caminho / chegou" | Card da cozinha |
| Entregador na loja (`DELIVERY_PICKUP_CODE_REQUESTED`) | Gestor digita o código que o motoboy informa → `validatePickupCode` | Card da cozinha |
| `DISPATCHED` / `COLLECTED` | `SAIU_PARA_ENTREGA` → dispara as notificações que já existem (WhatsApp/push) | `atualizarStatusPedidoComNotificacoes` |
| `DELIVERY_DROP_CODE_REQUESTED` | Código de entrega pro cliente (4 últimos dígitos do telefone ou `metadata.CODE`) | Página de acompanhamento / WhatsApp |
| Cliente pede outro endereço (`DELIVERY_ADDRESS_CHANGE_REQUESTED`) | Alerta com prazo de 15 min → aceitar / rejeitar | Card da cozinha |
| `CONCLUDED` | `ENTREGUE` | idem |
| Cancelar | `cancellationReasons` (lista dinâmica) → `cancel`; volta pro seletor de motoboy próprio | Card da cozinha |
| `CANCELLED` / `CANCELLATION_REQUEST_FAILED` vindos do iFood | Avisa a cozinha e libera atribuir motoboy próprio | idem |

Extras com pouco custo: `trackingUrl` na página de acompanhamento do cliente (link "acompanhar motoboy"), `GET /tracking` no mapa estilo Uber que já existe.

## Mudanças de banco (Supabase)

```sql
-- Conexão por loja (mesmo formato de restaurante_integracao_pagamento)
create table restaurante_integracao_ifood (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null unique references restaurantes(id),
  merchant_id text,
  merchant_nome text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  connection_status text not null default 'pendente', -- pendente | conectado | desconectado
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Logística iFood no pedido
alter table pedidos
  add column logistica text,                -- null/PROPRIA | IFOOD
  add column ifood_order_id text unique,
  add column ifood_tracking_url text,
  add column ifood_status text,             -- último evento recebido
  add column ifood_cotacao jsonb,           -- quote usado no registro
  add column ifood_pickup_code text,
  add column ifood_entregador jsonb,        -- dados do ASSIGN_DRIVER
  add column ifood_alteracao_endereco jsonb;

-- Deduplicação de eventos (webhook/polling)
create table eventos_ifood (
  event_id text primary key,
  ifood_order_id text,
  pedido_id uuid references pedidos(id),
  codigo text,
  payload jsonb,
  recebido_em timestamptz default now()
);
```

## Código novo (port do PHP validado para TypeScript)

| PHP (ifood-test) | goak |
|---|---|
| `lib/IfoodClient.php` | ✅ `utils/ifood.ts` — token por restaurante com refresh, retry 2x + jitter, `idempotency-key`, logs |
| `lib/Pdv.php` (shipping/endereço/cancelamento/coleta) | `utils/ifood/entrega.ts` |
| `lib/Pdv.php::apply` (eventos) | `utils/ifood/eventos.ts` + `app/api/webhooks/ifood/route.ts` |
| `index.php` (userCode) | ✅ `actions/adminIfood.ts` (Server Actions: iniciar, concluir, atualizar, desconectar) + `components/admin/ConfiguracaoIfoodEntrega.tsx` em `/admin/integracoes` |
| `api.php` | `app/api/admin/pedidos/[pedidoId]/ifood/{cotacao,chamar,cancelar,motivos,endereco,coleta}/route.ts` |
| `pdv.php` (telas) | `components/cozinha/CardPedidoCozinha.tsx` (+ hook `useCozinha.ts`) |

Lições da API real já incorporadas no PHP e que valem pro port:

- `cancellationCode` vai como **string** (a doc diz integer, a API recusa número).
- Pedidos POS chegam auto-confirmados (`PLACED` → `CONFIRMED`).
- Em teste, `GET /orders/{id}` mascara o endereço ("Rua TESTE") — usar o endereço do próprio pedido do goak.
- `validatePickupCode` responde 412 até o entregador chegar (não é "código inválido").
- Loja de teste **não aloca entregador** — cenários de coleta/encerramento dependem de resposta do suporte.

## Homologação — impacto

Os vídeos devem mostrar o **sistema real** (goak), não o PDV PHP. Ordem sugerida:

1. Implementar no goak usando o app "Teste (D)" + loja de teste.
2. Resolver com o suporte: simulação de entregador na loja de teste e webhook × polling.
3. Gravar os 4 cenários no goak e pedir homologação do "PDV-goak".

## Estimativa de esforço

| Bloco | Tamanho |
|---|---|
| SQL + conexão da loja (userCode/refresh) + card em Configurações | médio |
| Cliente iFood + cotação/chamar/cancelar + UI no card da cozinha | médio |
| Webhook + processamento de eventos + mapeamento de status/notificações | médio |
| Endereço (aceitar/rejeitar), código de coleta, trackingUrl no acompanhamento | pequeno |
| Testes no padrão `tests/homologacao/` + lint/build | pequeno |

## Como ativar a conexão da loja (parte 1, implementada)

1. Rodar `supabase-scripts/ifood-entrega-integracao.sql` no SQL Editor do Supabase (cria `restaurante_integracoes_ifood`, com RLS ligado e sem policies — só o service role acessa, porque guarda tokens).
2. Variáveis de ambiente:

```bash
IFOOD_CLIENT_ID=""        # app distribuído do iFood (dev: app de teste; produção: app homologado)
IFOOD_CLIENT_SECRET=""
IFOOD_API_BASE_URL="https://merchant-api.ifood.com.br"   # opcional, esse é o padrão
```

3. Em `/admin/integracoes`, card **iFood Entrega**: informar o ID da loja, aprovar o código no Portal do Parceiro com a conta dona da loja e colar o código de autorização.

## Taxa de entrega cobrada do cliente — "Entregas pelo iFood"

Opção por loja em **Integrações → iFood Entrega** (`supabase-scripts/ifood-entrega-taxa.sql`):

- `entregas_pelo_ifood` (padrão desligado): quando ligado, o checkout **ignora a taxa fixa e a tabela por bairro** da loja e cobra a cotação do iFood para o endereço do cliente (`deliveryAvailabilities`).
- `acrescimo_taxa_entrega` (padrão R$ 0,00, máx. R$ 100): valor somado à cotação. Taxa cobrada = cotação + acréscimo.
- **Fallback:** se o iFood não atender o endereço (fora da área, loja fechada, `OffOpeningHours`, erro), o checkout volta para a regra da loja (taxa fixa ou bairro).

Onde acontece:

- Tela: `app/[slug]/checkout/page.tsx` cota via `POST /api/restaurantes/[slug]/entrega-ifood` (700 ms depois que o cliente para de digitar; a cotação vale só para o endereço em que foi feita). Só exibição.
- Cobrança: `POST /api/checkout` cota de novo no servidor (`cotarTaxaEntregaIfoodCheckout`) e grava a cotação em `pedidos.ifood_cotacao` com `taxaCobradaCliente`.
- Cozinha: `PainelIfoodEntrega` já abre com essa cotação se ainda estiver válida (senão cota de novo) e mostra quanto o cliente pagou.

O `merchantFee` enviado ao iFood ao chamar o entregador continua sendo a taxa paga pelo cliente (`valor_total − itens`).

## Aviso de "pronto para coleta" (readyToPickup)

O entregador do iFood só retira o pedido depois que a loja avisa que ele está pronto (`POST /order/v1.0/orders/{id}/readyToPickup`). No teste de 04-10-2026 o entregador ficou parado na loja até esse aviso ser enviado.

O goak envia o aviso automaticamente (`avisarPedidoProntoIfood` em `utils/ifood-entrega.ts`):

- quando a cozinha marca o pedido como PRONTO (`POST /api/admin/pedidos/[pedidoId]/status`);
- ao chamar o entregador com o pedido já PRONTO;
- no evento CONFIRMED do iFood, se o pedido já estiver PRONTO (caso o primeiro aviso tenha saído cedo demais).

Falha no aviso só gera log: não bloqueia a mudança de status da cozinha.
