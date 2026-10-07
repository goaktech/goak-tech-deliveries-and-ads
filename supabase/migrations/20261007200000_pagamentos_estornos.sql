-- Registro de pagamentos, estornos e lock de refresh de token (Mercado Pago)

ALTER TABLE public.restaurante_integracoes_pagamento
  ADD COLUMN IF NOT EXISTS token_refresh_lock_until timestamptz;

CREATE TABLE IF NOT EXISTS public.pagamentos_pedido (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  restaurante_id uuid NOT NULL,
  mercado_pago_payment_id text NOT NULL,
  status text NOT NULL,
  metodo text,
  valor numeric(10,2) NOT NULL,
  valor_estornado numeric(10,2) NOT NULL DEFAULT 0,
  duplicado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT pagamentos_pedido_payment_id_key UNIQUE (mercado_pago_payment_id)
);
CREATE INDEX IF NOT EXISTS pagamentos_pedido_pedido_idx ON public.pagamentos_pedido (pedido_id);
CREATE INDEX IF NOT EXISTS pagamentos_pedido_restaurante_idx ON public.pagamentos_pedido (restaurante_id);
ALTER TABLE public.pagamentos_pedido ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pagamentos_pedido_select_gestor ON public.pagamentos_pedido;
CREATE POLICY pagamentos_pedido_select_gestor ON public.pagamentos_pedido
  FOR SELECT TO authenticated
  USING (restaurante_id = public.restaurante_id_do_gestor_logado());

CREATE TABLE IF NOT EXISTS public.estornos_pedido (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  restaurante_id uuid NOT NULL,
  mercado_pago_payment_id text NOT NULL,
  mercado_pago_refund_id text,
  valor numeric(10,2) NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('TOTAL','PARCIAL')),
  motivo text,
  status text NOT NULL DEFAULT 'SOLICITADO',
  cancelou_pedido boolean NOT NULL DEFAULT false,
  solicitado_por uuid,
  erro text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS estornos_pedido_pedido_idx ON public.estornos_pedido (pedido_id);
CREATE INDEX IF NOT EXISTS estornos_pedido_restaurante_idx ON public.estornos_pedido (restaurante_id);
ALTER TABLE public.estornos_pedido ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS estornos_pedido_select_gestor ON public.estornos_pedido;
CREATE POLICY estornos_pedido_select_gestor ON public.estornos_pedido
  FOR SELECT TO authenticated
  USING (restaurante_id = public.restaurante_id_do_gestor_logado());
