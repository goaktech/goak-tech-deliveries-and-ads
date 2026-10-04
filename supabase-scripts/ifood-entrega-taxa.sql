-- supabase-scripts/ifood-entrega-taxa.sql
-- "Entregas pelo iFood": com a opção ligada, o checkout cobra do cliente a
-- cotação do iFood Entrega (+ acréscimo opcional) no lugar da taxa fixa ou da
-- tabela por bairro da loja. Rodar depois de ifood-entrega-integracao.sql.
alter table public.restaurante_integracoes_ifood
  add column if not exists entregas_pelo_ifood boolean not null default false,
  add column if not exists acrescimo_taxa_entrega numeric(10, 2) not null default 0
    check (acrescimo_taxa_entrega >= 0);
