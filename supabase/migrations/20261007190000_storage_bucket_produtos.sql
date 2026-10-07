-- Bucket público "produtos" (logos, fotos de capa e imagens de cardápio).
-- As policies de storage.objects que o referenciam estão na baseline (remote_schema).
-- Idempotente: no ambiente de testes o bucket já existe.
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do nothing;
