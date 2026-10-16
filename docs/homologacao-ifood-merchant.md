# Homologação iFood — módulo Merchant (app `appetitoso_com_br`)

14-10-2026 — Shipping aprovado pelo suporte; falta enviar os vídeos do Merchant no mesmo chamado.

## O que o goak faz (tela Admin → Pagamentos e Integrações → card iFood)

Tudo aparece com a loja conectada, logo abaixo do status de operação. Com `IFOOD_HOMOLOGACAO=true`, a página mostra no topo a faixa com o `client_id` e a data/hora ao vivo, como o iFood pede nos vídeos.

| Cenário | Tela | Endpoint |
|---|---|---|
| 1 · Lojas vinculadas | **Listar lojas vinculadas** (tabela com nome, razão social e ID) | `GET /merchant/v1.0/merchants?page&size` |
| 1 · Detalhes da loja | **Detalhes** em cada loja: ID, razão social, situação, tipo, descrição, ticket médio, exclusiva, data de cadastro, endereço com coordenadas, operações e canais | `GET /merchants/{id}` |
| 1 · Disponibilidade | Bloco **Disponibilidade agora** nos detalhes, e o status no topo do card | `GET /merchants/{id}/status` |
| 2 · Cadastrar pausa | **Pausas da loja** → motivo, início, fim → **Cadastrar pausa** | `POST /merchants/{id}/interruptions` |
| 2 · Listar pausas | **Listar pausas ativas** (marca "ativa" ou "agendada") | `GET /merchants/{id}/interruptions` |
| 2 · Remover pausa | **Remover** na pausa | `DELETE /merchants/{id}/interruptions/{interruptionId}` |
| 3 · Cadastrar horário | **Horário de funcionamento** → turnos por dia → **Salvar horários no iFood** | `PUT /merchants/{id}/opening-hours` |
| 3 · Consultar horário | **Consultar horários configurados** (o que o iFood devolve) | `GET /merchants/{id}/opening-hours` |

Detalhes da API usados (especificação OpenAPI do Developer Portal + testes na loja de testes em 14-10-2026):

- Pausa: corpo `{ description, start, end }`. **Hora local de Brasília, sem fuso** (`2026-10-14T13:44:00`). Se o horário for com fuso (`-03:00` ou `Z`), o iFood converte para UTC e passa a tratar o resultado como hora local: a pausa fica 3 h depois do pedido. Com o horário sem fuso, a loja passou a "Fechada — Em Pausa programada" no minuto exato, e o Portal mostrou o mesmo horário.
- O `DELETE` de pausa responde **409** se a pausa acabou de ser criada; o goak avisa para tentar de novo em alguns segundos.
- Horário: corpo `{ storeId, shifts: [{ dayOfWeek, start: "HH:MM:SS", duration (minutos) }] }`. O `PUT` substitui a semana inteira, então dia sem turno fica fechado. O goak valida o formato HH:MM, o fim depois do início e a ausência de turnos sobrepostos.
- **Os `GET` de pausas e de horários do iFood demoram de 2 a 4 minutos para refletir uma mudança** (o Portal e o status de operação atualizam antes). Por isso o goak mostra na hora a pausa criada (201) e tira a removida (204), e depois de salvar o horário mantém no editor o que foi gravado. O botão "Consultar horários configurados" mostra o que o `GET` devolve, que pode vir atrasado nos primeiros minutos.

## Roteiro dos vídeos

Um vídeo por cenário, mostrando a faixa com `client_id` e relógio, e com o **Portal do Parceiro** (loja de testes) aberto em outra aba para mostrar o reflexo de cada ação.

### Cenário 1 — Informações da loja

1. Integrações → card iFood → **Listar lojas vinculadas**.
2. **Detalhes** na loja de testes: mostrar todos os campos.
3. Mostrar o bloco **Disponibilidade agora** (e o status de operação no topo do card).

Credenciais da gravação: app de teste **Teste (D)**, `client_id c6107df7-6c82-4f4e-8743-c4d7f340b921` (o `appetitoso_com_br` recebe 403 nas rotas de loja enquanto o Merchant não for homologado). No ambiente local, as linhas do Teste (D) do `.env.development.local` estão ativas; para voltar ao `appetitoso_com_br`, comente-as de novo.

### Cenário 2 — Interrupção na loja

1. **Pausas da loja**: motivo "Teste de homologação", início agora, fim daqui a 30 min → **Cadastrar pausa**.
2. Portal do Parceiro: mostrar a loja pausada / a pausa listada.
3. goak: **Listar pausas ativas** → a pausa aparece como "ativa". Mostrar a mesma pausa no Portal.
4. Mostrar o status de operação no topo do card: "Fechada — Em Pausa programada" com o mesmo horário.
5. goak: **Remover** → confirmar. Se aparecer o aviso de pausa recém-criada (409), esperar alguns segundos e remover de novo.
6. Portal do Parceiro: recarregar "Pausas e feriados" e mostrar "Você não tem nenhuma pausa"; status do goak volta para "Aberta".

### Cenário 3 — Horário de funcionamento

1. **Horário de funcionamento**:
   - Sábado: 10:00 às 19:00.
   - Domingo: 09:00 às 12:00, 13:00 às 16:00 e 17:00 às 23:00 (três turnos com **+ turno**).
2. **Salvar horários no iFood**.
3. Portal do Parceiro → Configurações → Horários: mostrar os mesmos turnos (atualiza na hora).
4. Esperar uns 3 minutos e clicar em **Consultar horários configurados** → conferir sábado e domingo no bloco "Horários configurados no iFood".

Atenção: o `PUT` grava a semana inteira. Os outros dias precisam estar preenchidos no editor antes de salvar (o editor carrega o horário atual do iFood ao abrir).

Estado da loja de testes em 14-10-2026, depois dos testes: todos os dias 00:00–23:59 (sábado e domingo restaurados pelo goak), pronta para gravar o Cenário 3 do zero.

## Resposta para o chamado (preencher os links depois do upload)

> Olá! Seguem os vídeos do módulo Merchant, gravados em DD/MM/AAAA, entre HH:MM e HH:MM, com o aplicativo de teste WILLIAN CARVALHO DOS SANTOS 02407164180 - Teste (D) (client_id c6107df7-6c82-4f4e-8743-c4d7f340b921) na loja de testes "Teste - WILLIAN CARVALHO DOS SANTOS 02407164180" (merchant d474e187-a741-43e8-a78e-20202b21cd06). É o mesmo sistema goak que será usado pelo appetitoso_com_br (client_id efb4ac64-5afd-485d-8af2-85e7be8a4ef8).
>
> - Cenário 1 — Informações da loja (listagem, detalhes e disponibilidade): LINK
> - Cenário 2 — Interrupção na loja (cadastrar, listar e remover pausa, com reflexo no Portal do Parceiro): LINK
> - Cenário 3 — Horário de funcionamento (sábado 10h–19h; domingo 9h–12h, 13h–16h e 17h–23h; consulta e reflexo no Portal do Parceiro): LINK
>
> Obrigado!
