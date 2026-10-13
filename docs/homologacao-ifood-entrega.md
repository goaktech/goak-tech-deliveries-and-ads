# Homologação iFood — módulo Shipping (goak)

Roteiro para gravar os vídeos e abrir o chamado de homologação do app distribuído do goak no iFood (módulo **Shipping**: pedidos fora da plataforma, `salesChannel=POS`).

Critérios recebidos do suporte do iFood (29-09-2026):

- 1 vídeo **por cenário**, separados, mostrando execução real no sistema;
- **data/hora** e o **client_id do app de teste** visíveis em cada vídeo;
- envio por **link** (Google Drive com acesso para quem tiver o link), nunca anexo;
- só pedir com o desenvolvimento finalizado; um chamado não mistura verticais (Food × Groceries) nem o módulo financeiro; se algum critério falhar, o chamado é encerrado e é preciso abrir outro.

## Preparação

1. `.env.development.local` com as credenciais do app de teste **distribuído** (`... - Teste (D)`) e `IFOOD_HOMOLOGACAO=true`. A cozinha passa a mostrar uma faixa vermelha com `client_id` + relógio (`components/cozinha/FaixaHomologacaoIfood.tsx`).
2. Loja de teste conectada em **Integrações → iFood Entrega** (merchant `d474e187-a741-43e8-a78e-20202b21cd06`, Bujari/AC).
3. Gravar **de dia**: à noite o iFood responde `OffOpeningHours` e o entregador simulado não é alocado.
4. Pedidos de teste com endereço perto da loja de teste (ex.: Ramal Bujari, 350 — `-9.818184, -67.948089`). Endereços longe dão `DeliveryDistanceTooHigh`.
5. Gravar a tela inteira da cozinha (`/admin/cozinha`) com a faixa visível: no macOS, `Cmd+Shift+5` → "Gravar tela inteira".

## Cenário 1 — Gestão de pedidos sob demanda (`DELIVERY` / `IMMEDIATE`)

1. Pedido pago na coluna **Em preparo** → botão **Entregador iFood** → mostra cotação (valor, distância, tempo) → **Confirmar**.
2. Eventos chegando no card: `PLACED` → `CONFIRMED` → **Em preparo — iFood avisado** (`startPreparation`, enviado automaticamente).
3. **Concluir preparo** → **Pronto — aguardando o entregador** (`readyToPickup`).
4. Entregador atribuído (nome no card) → chega na loja → coleta → **Saiu para entrega** (o goak muda o status sozinho) → **Entregue** (`CONCLUDED`).
5. Mostrar o link **Rastreio** abrindo a página de acompanhamento do iFood.

O ciclo completo leva ~30–60 min na loja de teste; dá para pausar a gravação entre as etapas, desde que a faixa com relógio apareça em cada trecho.

## Cenário 2 — Confirmação de pedido delivery + alteração de endereço

1. Chamar o entregador (como no cenário 1) e aguardar `CONFIRMED`.
2. Simular o **cliente** pedindo outro endereço (até 500 m). A loja não tem tela para isso — é o lado do cliente; rodar no terminal (fora da gravação ou mostrando o comando):

   ```bash
   curl -X POST "https://merchant-api.ifood.com.br/shipping/v1.0/orders/<ifood_order_id>/deliveryAddressChangeRequest" \
     -H "Authorization: Bearer <token>" -H 'content-type: application/json' \
     -d '{"streetName":"Ramal Bujari","streetNumber":"500","neighborhood":"Bujari","city":"Bujari","state":"AC","country":"BR","postalCode":"69923000","coordinates":{"latitude":-9.816084,"longitude":-67.948589}}'
   ```

3. No card: **O cliente pediu outro endereço** com endereço atual × novo, distância e contagem dos 15 min.
4. Pedido A: **Aceitar** → `DELIVERY_ADDRESS_CHANGE_ACCEPTED` → card mostra "Endereço novo aceito" e o endereço do pedido muda.
5. Pedido B (outro pedido, mesma simulação): **Recusar** → `DELIVERY_ADDRESS_CHANGE_DENIED`.

## Cenário 3 — Cancelamento

1. Pedido com entregador iFood chamado → **Cancelar entrega pelo iFood**.
2. Select com os motivos que o iFood devolve (`cancellationReasons`) → escolher → **Confirmar cancelamento**.
3. `CANCELLED` chega → card volta a oferecer entregador (próprio ou iFood) — a venda continua no goak.

## Cenário 4 — Código de coleta

1. Pedido com entregador iFood, **pronto** (`readyToPickup`).
2. Quando o entregador chega (`ARRIVED_AT_ORIGIN`, card mostra "Entregador na loja — peça o código de coleta"), digitar o código e **Validar** → "Código válido: pode entregar o pedido ao entregador".
3. Mostrar também um código errado → "Código inválido: não entregue o pedido".

No ambiente de teste o código fica em `delivery.pickupCode` dos detalhes do pedido (`GET /order/v1.0/orders/{id}`).

## Requisitos não funcionais (já atendidos)

- Polling de eventos a cada 30 s no servidor (`utils/ifood-polling.ts`, não depende da cozinha aberta) com `x-polling-merchants`, acknowledgment imediato e deduplicação por `eventId` (`eventos_ifood`).
- Token renovado antes de expirar; retry com backoff exponencial + jitter em 429/5xx; `idempotency-key` nos POSTs (`utils/ifood.ts`).
- Observações do cliente (`delivery.observations`) destacadas no card.

## Abrir o chamado

Developer Portal → Suporte → novo chamado de **homologação**, módulo **Shipping**, app distribuído do goak. Colar os 4 links (um por cenário) e o `client_id` do app de teste.
