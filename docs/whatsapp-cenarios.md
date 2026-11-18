# WhatsApp — cenários 1 a 5

Como o Appetitoso usa o WhatsApp com o cliente, com a loja e com a equipe. O código fica em `utils/whatsapp-envio.ts` (a camada única de envio), `utils/whatsapp-aviso-venda.ts`, `utils/notificacoes-pedido.ts` e `app/api/webhooks/whatsapp/route.ts`. As migrações são `20261016130000_whatsapp_cenarios.sql`, `20261112120000_whatsapp_atendimento_loja.sql` e `20261118120000_whatsapp_conversas.sql`. As conversas (cenário 5) ficam em `utils/whatsapp-conversas.ts` e os modelos em `utils/whatsapp-modelos.ts`.

| # | Cenário | Quem recebe | De onde sai |
|---|---|---|---|
| 1 | Botão **"Falar com a loja no WhatsApp"** no acompanhamento do pedido | O cliente abre a conversa com a loja | Link `wa.me` com a mensagem "Olá! Sobre meu pedido #N." |
| 2 | **Aviso interno de venda** quando o pedido passa de PENDENTE para PAGO | Dono e equipe da loja, e a equipe Appetitoso | Número do Appetitoso, template `WHATSAPP_TEMPLATE_AVISO_VENDA` |
| 3 | **Status do pedido para o cliente** (preparo, saiu, entregue…) e o acompanhamento de enviado, entregue, lido e falhou | Cliente | Número do Appetitoso (remetente único), template `WHATSAPP_TEMPLATE_STATUS_PEDIDO` |
| 4 | **Número próprio da loja** | Cliente | Número da loja, só quando a equipe libera |
| 5 | **Conversas**: o cliente responde no WhatsApp e a loja responde pelo painel | Cliente | Número do Appetitoso, texto livre em até 24 h |

## Cenário 1 — Falar com a loja

- O gestor cadastra o número em **Admin → Configurações → WhatsApp de atendimento**. Vai para a coluna `restaurantes.whatsapp_atendimento`, só com dígitos.
- Se a loja não cadastrou, vale o `whatsappAtendimento` fixo de `utils/config-lojas-especiais.ts` (Perucho, Dona Fit). Sem nenhum dos dois, o botão não aparece.

## Cenário 2 — Aviso interno de venda

- **Quem da loja recebe:** o gestor cadastra em **Admin → Pagamentos e Integrações → Avisos de venda no WhatsApp**.
  - Para cada pessoa, informa nome, WhatsApp e a confirmação de que ela concordou em receber. Isso grava `consentimento_em`, porque sem consentimento não sai mensagem.
  - Dá para pausar ou remover, até 10 números por loja.
  - A tela também mostra os últimos 10 avisos e o status de entrega de cada um.
- **Quem da equipe Appetitoso recebe** os avisos de todas as lojas: cadastro direto no banco, com `restaurante_id` NULL:

```sql
insert into public.whatsapp_destinatarios_aviso (restaurante_id, nome, telefone, papel, consentimento_em)
values (null, 'Equipe Appetitoso', '5561999999999', 'plataforma', now());
```

- **Envio único:** cada par (pedido, destinatário) é reservado antes de enviar, com `UNIQUE` em `avisos_venda_whatsapp`. Por isso webhooks de pagamento em paralelo não duplicam o aviso. Falha no aviso nunca derruba o pagamento.
- **Template na Meta** (WhatsApp Manager do número do Appetitoso). Configuração:
  - nome sugerido: `aviso_venda_loja`;
  - categoria **Utilidade**;
  - idioma pt_BR;
  - variáveis na ordem: loja, número do pedido, valor e cliente.

  Corpo (não pode começar nem terminar com variável):

  ```
  Nova venda! A loja {{1}} recebeu o pedido {{2}} no valor de {{3}}, do cliente {{4}}. Abra o painel da cozinha para começar o preparo.
  ```

  Exemplos para a aprovação: `Restaurante Exemplo`, `#123`, `R$ 58,90`, `Maria`.

## Cenário 3 — Remetente único e status de entrega

- **Mudança de comportamento:** antes, a loja com WhatsApp conectado enviava pelo próprio número. Agora **todas enviam pelo número do Appetitoso**, salvo a loja liberada no cenário 4.
- **Webhook** (app da Meta → WhatsApp → Configuração):
  - URL de retorno: `https://<domínio>/api/webhooks/whatsapp`;
  - token de verificação: `WHATSAPP_WEBHOOK_VERIFY_TOKEN`;
  - assinar o campo **messages**.

  Cada POST é validado pela assinatura `x-hub-signature-256` com `WHATSAPP_META_APP_SECRET`. Sem esse segredo, todo POST é recusado com 401.
- **Status:** os eventos `sent`, `delivered`, `read` e `failed` atualizam `entrega_status` em `notificacoes_pedido` e em `avisos_venda_whatsapp`. Os eventos chegam fora de ordem, então o status nunca volta (de "lido" para "entregue", por exemplo), mas `failed` sempre vale.

## Cenário 4 — Número próprio da loja

- O gancho fica em `resolverRemetenteWhatsapp`. A loja usa o próprio número só quando duas coisas valem ao mesmo tempo:
  - `restaurantes.whatsapp_proprio_liberado = true`;
  - a conexão está "conectada", com template aprovado e token válido.

  Em qualquer outro caso, cai no número do Appetitoso e grava um aviso no log.
- Ainda não há papel de administrador da plataforma no painel, então a liberação é feita no banco:

```sql
update public.restaurantes set whatsapp_proprio_liberado = true where slug = 'perucho';
```

## Variáveis de ambiente (Vercel)

| Variável | Uso |
|---|---|
| `WHATSAPP_BUSINESS_ACCESS_TOKEN` / `WHATSAPP_BUSINESS_PHONE_NUMBER_ID` | Número do Appetitoso (remetente único) |
| `WHATSAPP_BUSINESS_API_VERSION` | Opcional (padrão v23.0) |
| `WHATSAPP_TEMPLATE_STATUS_PEDIDO` | Template de status para o cliente (cenário 3) |
| `WHATSAPP_TEMPLATE_AVISO_VENDA` | Template do aviso de venda (cenário 2) |
| `WHATSAPP_TEMPLATE_LANGUAGE_CODE` | Opcional (padrão pt_BR) |
| `WHATSAPP_META_APP_SECRET` | Validar o webhook |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Verificação do webhook (GET) |
| `WHATSAPP_BUSINESS_WABA_ID` | Conta do WhatsApp do número do Appetitoso (tela de modelos) |
| `PLATAFORMA_ADMIN_EMAILS` | E-mails da equipe Appetitoso, separados por vírgula (página `/admin/whatsapp`) |

## Cenário 5 — Conversas (18-11-2026)

O mesmo processo do WhatsApp do willcarvalhopro, adaptado ao delivery, com uma diferença decidida pelo Will: o Appetitoso usa um **número novo, só da API**. Não há coexistência com o app do celular, e as conversas ficam só no painel.

- **Receber:** o webhook (campo `messages`) grava cada mensagem do cliente em `whatsapp_mensagens`. O payload bruto vai para `whatsapp_eventos`, com o erro do processamento quando houver. Mídia vira um rótulo, como "[foto] legenda" ou "[áudio]". O `referral` dos anúncios de clique para o WhatsApp fica em `anuncio_id` e `anuncio_json`.
- **Rotear:** a função SQL `whatsapp_rotear_conversa` leva a conversa para a loja do **último pedido** daquele telefone nos últimos 60 dias.
  - O telefone casa por DDD + 8 últimos dígitos, então vale com ou sem o 9 e com ou sem o 55.
  - Sem pedido, a conversa fica só na caixa da equipe Appetitoso.
- **Responder:** a resposta é texto livre e só vale **até 24 h depois da última mensagem do cliente** (regra da Meta). Depois disso, o painel avisa que só dá para mandar um modelo aprovado. O status (Enviada, Entregue, Lida ou Não entregue) chega pelo webhook.
- **Telas:**
  - `/admin/conversas` (aba "Conversas"): a loja vê e responde as conversas dos seus clientes. A tela se atualiza a cada 15 s.
  - `/admin/whatsapp`: só para a equipe Appetitoso (`PLATAFORMA_ADMIN_EMAILS`). Mostra o número (qualidade e nome de exibição), o checklist da configuração, os últimos erros do webhook, **todas** as conversas (inclusive as sem loja) e os **modelos**, com a lista e o status deles e a criação de um modelo só com texto, com os exemplos que a Meta exige.

### Configuração na Meta (número novo, só API)

Feita no app que o goak já usa (o mesmo do `META_ADS_APP_ID`), na Business Manager onde fica o Appetitoso.

1. **Produto WhatsApp no app.** Em WhatsApp → Configuração da API, adicionar o número novo na conta do WhatsApp (WABA) do Appetitoso.
   - Verificar o número por SMS ou ligação.
   - Registrar o número com um PIN de 6 dígitos (`POST /{phone_number_id}/register`).
   - Como o número é novo e não fica no app do celular, registrar é o certo. No número em coexistência do willcarvalhopro, isso não podia ser feito.
2. **Nome de exibição "Appetitoso"**, que a Meta revisa. Com a empresa verificada, o limite de envios sobe.
3. **Usuário do sistema com token permanente.** Em Configurações do negócio → Usuários do sistema:
   - criar o usuário (admin);
   - atribuir o app e a WABA com controle total;
   - gerar o token com `whatsapp_business_messaging` e `whatsapp_business_management`, sem expiração.
   - Os tokens antigos vencem e derrubam o envio: o do `.env.local` já não funciona mais.
4. **Variáveis na Vercel:** `WHATSAPP_BUSINESS_ACCESS_TOKEN` (token do sistema), `WHATSAPP_BUSINESS_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_WABA_ID` e `PLATAFORMA_ADMIN_EMAILS`.
5. **Webhook.** Em WhatsApp → Configuração:
   - URL `https://<domínio>/api/webhooks/whatsapp`;
   - token de verificação igual a `WHATSAPP_WEBHOOK_VERIFY_TOKEN`;
   - assinar o campo **messages**;
   - preencher `WHATSAPP_META_APP_SECRET` com a chave secreta do app;
   - inscrever o app na WABA: `POST /{waba_id}/subscribed_apps` com o token do sistema.
6. **Modelos** (em `/admin/whatsapp` ou no Gerenciador do WhatsApp), na categoria Utilidade:
   - `status_pedido` → `WHATSAPP_TEMPLATE_STATUS_PEDIDO`;
   - `aviso_venda_loja` → `WHATSAPP_TEMPLATE_AVISO_VENDA`.
7. **Modo do app:**
   - em desenvolvimento, só números de teste cadastrados recebem;
   - para clientes reais, o app precisa estar Ao vivo;
   - para usar só o número do próprio negócio, basta o acesso padrão;
   - a Análise do app só é necessária quando cada loja for conectar o próprio número (cenário 4).

## Para colocar no ar

1. Aplicar as três migrações no Supabase.
2. Criar e aprovar o template de aviso de venda e preencher `WHATSAPP_TEMPLATE_AVISO_VENDA`.
3. Configurar o webhook da Meta e preencher `WHATSAPP_META_APP_SECRET`.
4. Cadastrar a equipe Appetitoso (SQL acima). As lojas cadastram os próprios números no painel.
5. Teste: um pedido pago numa loja de teste. O aviso deve chegar, e em "Últimos avisos" o status passa de Enviado para Entregue.
6. Conversas: mandar uma mensagem de um celular para o número do Appetitoso. Ela deve aparecer em `/admin/whatsapp`, e na aba Conversas da loja se esse celular fez pedido nela. Responder pelo painel e conferir o status.
