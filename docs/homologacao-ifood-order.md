# Homologação iFood — módulos Events + Order (app `appetitoso_com_br`)

12-10-2026

App distribuído **appetitoso_com_br** (categoria PDV, não listado, módulos Order + Shipping + Events + Merchant; os módulos não podem mais ser editados). A homologação automática do Developer Portal cobre só **Events + Order**; Shipping e Merchant são homologados depois, por chamado de suporte (roteiro em `homologacao-ifood-entrega.md`).

Enquanto o app não for aprovado, o portal **não libera as credenciais dele** (por ter o módulo Order). A homologação foi executada com o app de teste `... - Teste (D)` na loja de teste, que é o `IFOOD_CLIENT_ID` de `.env.development.local`.

## O que o goak faz

- **Polling contínuo** (`utils/ifood-polling.ts`): a cada 30 s, para todas as lojas conectadas, sem depender da cozinha aberta.
  - Processo Node contínuo (`npm run dev` / `next start`): `instrumentation.ts` liga o laço na subida do servidor. `IFOOD_POLLING_CONTINUO=false` desliga.
  - Serverless (Vercel): não há processo contínuo. Um agendador externo precisa chamar `POST /api/cron/ifood/eventos` a cada 30 s com `Authorization: Bearer <CRON_SECRET>`. Sem isso, o polling só acontece com a cozinha aberta (reserva em `/api/admin/ifood/eventos`).
- **Status de operação da loja** (`GET /merchant/v1.0/merchants/{id}/status`): no card iFood de Integrações e numa faixa da cozinha (`components/admin/StatusOperacaoIfood.tsx`), atualizado a cada 30 s.
- **Pedidos recebidos do iFood** (`utils/ifood-pedidos.ts`, tabela `pedidos_ifood`, criada pela migration `supabase/migrations/20261013120000_ifood_pedidos.sql`): o evento `PLACED` busca os detalhes e cria o pedido; a seção "Pedidos do iFood" da cozinha confirma, cancela (motivos de `cancellationReasons`), avisa que está pronto e despacha. Os eventos seguintes atualizam o status.

## Etapas executadas

| Etapa | Resultado | Evidências (`docs/homologacao-ifood-evidencias/`) |
|---|---|---|
| 1. Conectividade | "Presença do aplicativo validada com sucesso" | `12-10-2026-etapa1-*` |
| 2. Receber e confirmar | 4 pedidos recebidos e confirmados (`CONFIRMED`) | `12-10-2026-etapa2-*` |
| 3. Cancelar | pedido 1790 cancelado com o motivo 501 (`CANCELLED`) | `12-10-2026-etapa3-*` |
| 4. Despachar | pedido 4595 despachado (`DISPATCHED`) | `12-10-2026-etapa4-*` |
| 5. Validar | pedido 4595 exibido como "Concluído" (`CONCLUDED`) | `12-10-2026-etapa5-*` |

Status no portal: **Homologação finalizada** — em análise pelo iFood, resultado por e-mail.

## Depois da aprovação

1. Copiar Client ID e Client Secret do app em Developer Portal → Meus aplicativos → appetitoso_com_br → Credenciais para `IFOOD_CLIENT_ID` / `IFOOD_CLIENT_SECRET` (digitar direto no `.env.local`, nunca em chat).
2. Reconectar cada loja em Integrações (o token do app de teste não vale para o app novo).
3. Abrir chamado de suporte para homologar Shipping e Merchant.
