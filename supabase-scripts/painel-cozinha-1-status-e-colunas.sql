DO $$
DECLARE
  tipo_coluna text;
  nome_tipo text;
  restricao record;
BEGIN
  SELECT data_type, udt_name
    INTO tipo_coluna, nome_tipo
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'pedidos' AND column_name = 'status';

  IF tipo_coluna = 'USER-DEFINED' THEN
    EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', nome_tipo, 'CANCELADO');
  ELSE
    FOR restricao IN
      SELECT conname
        FROM pg_constraint
       WHERE conrelid = 'public.pedidos'::regclass
         AND contype = 'c'
         AND pg_get_constraintdef(oid) ILIKE '%status%'
         AND pg_get_constraintdef(oid) ILIKE '%ENTREGUE%'
    LOOP
      EXECUTE format('ALTER TABLE public.pedidos DROP CONSTRAINT %I', restricao.conname);
    END LOOP;

    ALTER TABLE public.pedidos
      ADD CONSTRAINT pedidos_status_check
      CHECK (status IN ('PENDENTE', 'PAGO', 'PREPARANDO', 'PRONTO', 'SAIU_PARA_ENTREGA', 'ENTREGUE', 'CANCELADO'));
  END IF;
END $$;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS numero_pedido integer,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text,
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz;

CREATE INDEX IF NOT EXISTS pedidos_restaurante_created_at_idx ON public.pedidos (restaurante_id, created_at);
CREATE INDEX IF NOT EXISTS pedidos_restaurante_status_idx ON public.pedidos (restaurante_id, status);
