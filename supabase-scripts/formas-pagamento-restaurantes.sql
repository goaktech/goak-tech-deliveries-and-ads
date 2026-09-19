-- Formas de pagamento aceitas por loja (painel do gestor > Pagamentos e Integrações).
-- Valores possíveis: 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO'.
-- Padrão 'PIX' para todas as lojas: é o comportamento que já existia (cartão estava oculto no checkout).
-- Idempotente: pode rodar mais de uma vez.

alter table public.restaurantes
  add column if not exists formas_pagamento_aceitas text[] not null default array['PIX']::text[];

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurantes_formas_pagamento_validas'
  ) then
    alter table public.restaurantes
      add constraint restaurantes_formas_pagamento_validas
      check (
        cardinality(formas_pagamento_aceitas) > 0
        and formas_pagamento_aceitas <@ array['PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO']::text[]
      );
  end if;
end $$;
