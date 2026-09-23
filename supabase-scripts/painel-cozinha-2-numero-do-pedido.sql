CREATE OR REPLACE FUNCTION public.definir_numero_pedido()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  dia_local date;
BEGIN
  IF NEW.numero_pedido IS NOT NULL THEN
    RETURN NEW;
  END IF;

  dia_local := (COALESCE(NEW.created_at, now()) AT TIME ZONE 'America/Sao_Paulo')::date;

  PERFORM pg_advisory_xact_lock(hashtext('numero_pedido:' || NEW.restaurante_id::text || ':' || dia_local::text));

  SELECT COALESCE(MAX(numero_pedido), 0) + 1
    INTO NEW.numero_pedido
    FROM public.pedidos
   WHERE restaurante_id = NEW.restaurante_id
     AND created_at >= (dia_local::timestamp AT TIME ZONE 'America/Sao_Paulo')
     AND created_at < ((dia_local + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_definir_numero_pedido ON public.pedidos;
CREATE TRIGGER trg_definir_numero_pedido
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.definir_numero_pedido();

WITH numerados AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY restaurante_id, (created_at AT TIME ZONE 'America/Sao_Paulo')::date
      ORDER BY created_at, id
    ) AS numero
  FROM public.pedidos
)
UPDATE public.pedidos AS p
   SET numero_pedido = numerados.numero
  FROM numerados
 WHERE p.id = numerados.id
   AND p.numero_pedido IS NULL;
