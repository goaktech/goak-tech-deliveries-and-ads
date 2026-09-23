CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.cancelar_pedidos_pendentes_expirados()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quantidade integer;
BEGIN
  UPDATE public.pedidos
     SET status = 'CANCELADO',
         motivo_cancelamento = 'Pagamento não confirmado',
         cancelado_em = now(),
         updated_at = now()
   WHERE status = 'PENDENTE'
     AND created_at < now() - interval '12 hours';

  GET DIAGNOSTICS quantidade = ROW_COUNT;
  RETURN quantidade;
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_pedidos_pendentes_expirados() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cancelar-pedidos-pendentes-expirados';

SELECT cron.schedule(
  'cancelar-pedidos-pendentes-expirados',
  '*/30 * * * *',
  $$SELECT public.cancelar_pedidos_pendentes_expirados();$$
);
