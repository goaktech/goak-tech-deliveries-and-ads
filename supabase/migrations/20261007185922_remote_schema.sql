SET local check_function_bodies = off;

CREATE TABLE "public"."assinaturas_plataforma" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "restaurante_id"         uuid                     NOT NULL,
  "stripe_customer_id"     text                     NOT NULL,
  "stripe_subscription_id" text                     NOT NULL,
  "stripe_price_id"        text,
  "status"                 text                     NOT NULL DEFAULT 'pendente'::text,
  "periodo_inicio"         timestamp with time zone,
  "periodo_fim"            timestamp with time zone,
  "cancel_at_period_end"   boolean                  NOT NULL DEFAULT false,
  "created_at"             timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"             timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "assinaturas_plataforma_pkey" PRIMARY KEY (id),
  CONSTRAINT "assinaturas_plataforma_stripe_subscription_id_key" UNIQUE (stripe_subscription_id)
);

ALTER TABLE "public"."assinaturas_plataforma"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."complementos_produto" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "item_cardapio_id" uuid                     NOT NULL,
  "nome"             character varying(255)   NOT NULL,
  "preco_adicional"  numeric(10,2)            NOT NULL,
  "disponivel"       boolean                  NOT NULL DEFAULT true,
  "grupo"            text,
  "created_at"       timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "complementos_produto_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."complementos_produto"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."composicao_produto" (
  "id"                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "item_cardapio_id"      uuid                     NOT NULL,
  "insumo_id"             uuid                     NOT NULL,
  "quantidade_necessaria" numeric(10,4)            NOT NULL,
  "created_at"            timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "composicao_produto_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."composicao_produto"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."entregadores" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "restaurante_id" uuid                     NOT NULL,
  "nome"           text                     NOT NULL,
  "telefone"       text                     NOT NULL,
  "token_acesso"   text                     NOT NULL,
  "ativo"          boolean                  NOT NULL DEFAULT true,
  "created_at"     timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "entregadores_pkey" PRIMARY KEY (id),
  CONSTRAINT "entregadores_token_acesso_key" UNIQUE (token_acesso)
);

ALTER TABLE "public"."entregadores"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."eventos_ifood" (
  "event_id"       text                     NOT NULL,
  "restaurante_id" uuid,
  "ifood_order_id" text,
  "pedido_id"      uuid,
  "codigo"         text,
  "payload"        jsonb,
  "recebido_em"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "eventos_ifood_pkey" PRIMARY KEY (event_id)
);

ALTER TABLE "public"."eventos_ifood"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."eventos_webhook_stripe" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "stripe_event_id" text                     NOT NULL,
  "tipo_evento"     text                     NOT NULL,
  "payload_json"    jsonb                    NOT NULL,
  "erro_json"       jsonb,
  "processado_em"   timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "eventos_webhook_stripe_pkey" PRIMARY KEY (id),
  CONSTRAINT "eventos_webhook_stripe_stripe_event_id_key" UNIQUE (stripe_event_id)
);

ALTER TABLE "public"."eventos_webhook_stripe"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."insumos" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "restaurante_id" uuid                     NOT NULL,
  "nome"           character varying(255)   NOT NULL,
  "unidade_medida" character varying(10)    NOT NULL,
  "custo_unitario" numeric(10,4)            NOT NULL,
  "estoque_atual"  numeric(10,2)            NOT NULL DEFAULT 0.00,
  "estoque_minimo" numeric(10,2)            NOT NULL DEFAULT 0.00,
  "created_at"     timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "insumos_pkey" PRIMARY KEY (id),
  CONSTRAINT "insumos_unidade_medida_check" CHECK (((unidade_medida)::text = ANY ((ARRAY['g'::character varying, 'ml'::character varying, 'un'::character varying])::text[])))
);

ALTER TABLE "public"."insumos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."itens_cardapio" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "restaurante_id" uuid                     NOT NULL,
  "nome"           character varying(255)   NOT NULL,
  "descricao"      text,
  "preco_venda"    numeric(10,2)            NOT NULL,
  "disponivel"     boolean                  NOT NULL DEFAULT true,
  "imagem_url"     text,
  "arquivado"      boolean                  NOT NULL DEFAULT false,
  "ordem"          integer,
  "created_at"     timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "categoria"      text,
  "dia_semana"     smallint,
  CONSTRAINT "itens_cardapio_dia_semana_check" CHECK (((dia_semana IS NULL) OR ((dia_semana >= 0) AND (dia_semana <= 6)))),
  CONSTRAINT "itens_cardapio_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."itens_cardapio"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."itens_pedido_complementos" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "item_pedido_id"         uuid                     NOT NULL,
  "complemento_produto_id" uuid,
  "nome"                   text                     NOT NULL,
  "preco_adicional"        numeric(10,2)            NOT NULL,
  "created_at"             timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "itens_pedido_complementos_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."itens_pedido_complementos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."itens_pedido" (
  "id"               uuid          NOT NULL DEFAULT gen_random_uuid(),
  "pedido_id"        uuid          NOT NULL,
  "item_cardapio_id" uuid          NOT NULL,
  "quantidade"       integer       NOT NULL,
  "preco_unitario"   numeric(10,2) NOT NULL,
  CONSTRAINT "itens_pedido_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."itens_pedido"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."logs_webhook_pagamentos" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "id_correlacao"  uuid                     NOT NULL,
  "restaurante_id" uuid,
  "payment_id"     text,
  "tipo_evento"    text,
  "etapa"          text                     NOT NULL,
  "nivel"          text                     NOT NULL,
  "mensagem"       text                     NOT NULL,
  "dados_json"     jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "erro_json"      jsonb,
  "created_at"     timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "logs_webhook_pagamentos_nivel_check" CHECK ((nivel = ANY (ARRAY['info'::text, 'sucesso'::text, 'alerta'::text, 'erro'::text]))),
  CONSTRAINT "logs_webhook_pagamentos_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."logs_webhook_pagamentos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."metricas_funil" (
  "id"                  uuid          NOT NULL DEFAULT gen_random_uuid(),
  "restaurante_id"      uuid          NOT NULL,
  "data"                date          NOT NULL DEFAULT CURRENT_DATE,
  "visitas_cardapio"    integer       NOT NULL DEFAULT 0,
  "checkouts_iniciados" integer       NOT NULL DEFAULT 0,
  "compras_concluidas"  integer       NOT NULL DEFAULT 0,
  "investimento_meta"   numeric(10,2) NOT NULL DEFAULT 0.00,
  "custo_meta_ads"      numeric(10,2),
  "cliques_anuncio"     integer,
  "impressoes_anuncio"  integer,
  CONSTRAINT "metricas_funil_pkey" PRIMARY KEY (id),
  CONSTRAINT "metricas_funil_restaurante_id_data_key" UNIQUE (restaurante_id, DATA)
);

ALTER TABLE "public"."metricas_funil"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."metricas_meta_ads_diarias" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "restaurante_id" uuid                     NOT NULL,
  "data"           date                     NOT NULL,
  "impressoes"     integer                  NOT NULL DEFAULT 0,
  "cliques"        integer                  NOT NULL DEFAULT 0,
  "gasto"          numeric(10,2)            NOT NULL DEFAULT 0,
  "ctr"            numeric(10,4)            NOT NULL DEFAULT 0,
  "cpc"            numeric(10,4)            NOT NULL DEFAULT 0,
  "cpm"            numeric(10,4)            NOT NULL DEFAULT 0,
  "created_at"     timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "metricas_meta_ads_diarias_pkey" PRIMARY KEY (id),
  CONSTRAINT "metricas_meta_ads_diarias_restaurante_id_data_key" UNIQUE (restaurante_id, DATA)
);

ALTER TABLE "public"."metricas_meta_ads_diarias"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."notificacoes_pedido" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "pedido_id"           uuid                     NOT NULL,
  "canal"               text                     NOT NULL,
  "status_destino"      text                     NOT NULL,
  "sucesso"             boolean                  NOT NULL,
  "provider_message_id" text,
  "payload_json"        jsonb,
  "erro_json"           jsonb,
  "created_at"          timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "notificacoes_pedido_canal_check" CHECK ((canal = ANY (ARRAY['whatsapp'::text, 'push'::text]))),
  CONSTRAINT "notificacoes_pedido_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."notificacoes_pedido"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."pedidos" (
  "id"                              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "restaurante_id"                  uuid                     NOT NULL,
  "status"                          character varying(50)    NOT NULL DEFAULT 'PENDENTE'::character varying,
  "valor_total"                     numeric(10,2)            NOT NULL,
  "forma_pagamento"                 character varying(50)    NOT NULL,
  "dados_cliente"                   jsonb                    NOT NULL,
  "codigo_acompanhamento"           text                     NOT NULL,
  "codigo_confirmacao_entrega"      text                     NOT NULL,
  "mercado_pago_external_reference" text                     NOT NULL,
  "mercado_pago_payment_id"         text,
  "cliente_latitude"                double precision,
  "cliente_longitude"               double precision,
  "distancia_entrega_km"            double precision,
  "tempo_deslocamento_min"          integer,
  "tempo_preparo_estimado_min"      integer,
  "entregador_id"                   uuid,
  "fb_browser_id"                   character varying(255),
  "fb_click_id"                     character varying(255),
  "created_at"                      timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"                      timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "numero_pedido"                   integer,
  "motivo_cancelamento"             text,
  "cancelado_em"                    timestamp with time zone,
  "logistica"                       text,
  "ifood_order_id"                  text,
  "ifood_tracking_url"              text,
  "ifood_status"                    text,
  "ifood_cotacao"                   jsonb,
  "ifood_entregador"                jsonb,
  "ifood_alteracao_endereco"        jsonb,
  "ifood_codigo_entrega"            text,
  "ifood_atualizado_em"             timestamp with time zone,
  CONSTRAINT "pedidos_codigo_acompanhamento_key" UNIQUE (codigo_acompanhamento),
  CONSTRAINT "pedidos_forma_pagamento_check"
    CHECK (((forma_pagamento)::text = ANY (ARRAY['PIX'::text, 'CARTAO'::text, 'CARTAO_CREDITO'::text, 'CARTAO_DEBITO'::text, 'DINHEIRO'::text]))),
  CONSTRAINT "pedidos_mercado_pago_external_reference_key" UNIQUE (mercado_pago_external_reference),
  CONSTRAINT "pedidos_pkey" PRIMARY KEY (id),
  CONSTRAINT "pedidos_status_check"
    CHECK
    (((status)::text = ANY ((ARRAY['PENDENTE'::character varying, 'PAGO'::character varying, 'PREPARANDO'::character varying, 'PRONTO'::character varying,
    'SAIU_PARA_ENTREGA'::character varying, 'ENTREGUE'::character varying, 'CANCELADO'::character varying])::text[])))
);

ALTER TABLE "public"."pedidos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."perfis_admin" (
  "id"             uuid                     NOT NULL,
  "restaurante_id" uuid                     NOT NULL,
  "nome"           text,
  "created_at"     timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "perfis_admin_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."perfis_admin"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."public_clientes" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "restaurante_id" uuid                     NOT NULL,
  "telefone"       text                     NOT NULL,
  "nome"           text                     NOT NULL,
  "email"          text,
  "endereco"       jsonb,
  "created_at"     timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "public_clientes_pkey" PRIMARY KEY (id),
  CONSTRAINT "public_clientes_restaurante_id_telefone_key" UNIQUE (restaurante_id, telefone)
);

ALTER TABLE "public"."public_clientes"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."push_subscriptions_pedido" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "pedido_id"  uuid                     NOT NULL,
  "endpoint"   text                     NOT NULL,
  "p256dh"     text                     NOT NULL,
  "auth"       text                     NOT NULL,
  "user_agent" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "push_subscriptions_pedido_pedido_id_endpoint_key" UNIQUE (pedido_id, endpoint),
  CONSTRAINT "push_subscriptions_pedido_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."push_subscriptions_pedido"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."restaurante_integracoes_ifood" (
  "id"                          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "restaurante_id"              uuid                     NOT NULL,
  "merchant_id"                 text,
  "merchant_nome"               text,
  "merchant_razao_social"       text,
  "merchant_status"             text,
  "merchant_endereco"           jsonb,
  "dados_atualizados_em"        timestamp with time zone,
  "access_token"                text,
  "refresh_token"               text,
  "token_expires_at"            timestamp with time zone,
  "authorization_code_verifier" text,
  "user_code"                   text,
  "verification_url"            text,
  "user_code_expires_at"        timestamp with time zone,
  "connection_status"           text                     NOT NULL DEFAULT 'pendente'::text,
  "created_at"                  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                  timestamp with time zone NOT NULL DEFAULT now(),
  "entregas_pelo_ifood"         boolean                  NOT NULL DEFAULT false,
  "acrescimo_taxa_entrega"      numeric(10,2)            NOT NULL DEFAULT 0,
  CONSTRAINT "restaurante_integracoes_ifood_acrescimo_taxa_entrega_check" CHECK ((acrescimo_taxa_entrega >= (0)::numeric)),
  CONSTRAINT "restaurante_integracoes_ifood_connection_status_check" CHECK ((connection_status = ANY (ARRAY['pendente'::text, 'conectado'::text, 'desconectado'::text]))),
  CONSTRAINT "restaurante_integracoes_ifood_pkey" PRIMARY KEY (id),
  CONSTRAINT "restaurante_integracoes_ifood_restaurante_id_key" UNIQUE (restaurante_id)
);

ALTER TABLE "public"."restaurante_integracoes_ifood"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."restaurante_integracoes_meta_ads" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "restaurante_id"    uuid                     NOT NULL,
  "connection_status" text                     NOT NULL DEFAULT 'pendente'::text,
  "access_token"      text,
  "token_expires_at"  timestamp with time zone,
  "ad_account_id"     text,
  "ad_account_name"   text,
  "meta_user_id"      text,
  "meta_user_email"   text,
  "created_at"        timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "restaurante_integracoes_meta_ads_connection_status_check" CHECK ((connection_status = ANY (ARRAY['pendente'::text, 'conectado'::text, 'desconectado'::text]))),
  CONSTRAINT "restaurante_integracoes_meta_ads_pkey" PRIMARY KEY (id),
  CONSTRAINT "restaurante_integracoes_meta_ads_restaurante_id_key" UNIQUE (restaurante_id)
);

ALTER TABLE "public"."restaurante_integracoes_meta_ads"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."restaurante_integracoes_pagamento" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "restaurante_id"    uuid                     NOT NULL,
  "provedor"          text                     NOT NULL DEFAULT 'mercado_pago'::text,
  "provider_user_id"  text,
  "access_token"      text,
  "refresh_token"     text,
  "token_expires_at"  timestamp with time zone,
  "connection_status" text                     NOT NULL DEFAULT 'pendente'::text,
  "account_email"     text,
  "created_at"        timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "public_key"        text,
  CONSTRAINT "restaurante_integracoes_pagamento_connection_status_check" CHECK ((connection_status = ANY (ARRAY['pendente'::text, 'conectado'::text, 'desconectado'::text]))),
  CONSTRAINT "restaurante_integracoes_pagamento_pkey" PRIMARY KEY (id),
  CONSTRAINT "restaurante_integracoes_pagamento_restaurante_id_key" UNIQUE (restaurante_id)
);

ALTER TABLE "public"."restaurante_integracoes_pagamento"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."restaurante_integracoes_whatsapp_business" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "restaurante_id"         uuid                     NOT NULL,
  "connection_status"      text                     NOT NULL DEFAULT 'pendente'::text,
  "access_token"           text,
  "token_expires_at"       timestamp with time zone,
  "meta_user_id"           text,
  "meta_user_email"        text,
  "waba_id"                text,
  "waba_name"              text,
  "phone_number_id"        text,
  "display_phone_number"   text,
  "template_name"          text,
  "template_language_code" text,
  "template_status"        text,
  "api_version"            text,
  "created_at"             timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "updated_at"             timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "restaurante_integracoes_whatsapp_busine_connection_status_check" CHECK ((connection_status = ANY (ARRAY['pendente'::text, 'conectado'::text, 'desconectado'::text]))),
  CONSTRAINT "restaurante_integracoes_whatsapp_business_pkey" PRIMARY KEY (id),
  CONSTRAINT "restaurante_integracoes_whatsapp_business_restaurante_id_key" UNIQUE (restaurante_id)
);

ALTER TABLE "public"."restaurante_integracoes_whatsapp_business"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."restaurantes" (
  "id"                               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "nome"                             character varying(255)   NOT NULL,
  "tipo"                             character varying(50)    NOT NULL,
  "slug"                             character varying(255)   NOT NULL,
  "endereco"                         text,
  "logo_url"                         text,
  "meta_pixel_id"                    character varying(100),
  "latitude"                         double precision,
  "longitude"                        double precision,
  "tempo_preparo_base_minutos"       integer                  NOT NULL DEFAULT 20,
  "tempo_preparo_incremento_minutos" integer                  NOT NULL DEFAULT 3,
  "tempo_preparo_teto_minutos"       integer                  NOT NULL DEFAULT 60,
  "horarios_funcionamento"           jsonb,
  "status_assinatura"                character varying(50)    NOT NULL DEFAULT 'pendente'::character varying,
  "gateway_customer_id"              text,
  "email_corporativo"                text,
  "stripe_account_id"                text,
  "meta_access_token"                text,
  "meta_ad_account_id"               text,
  "created_at"                       timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "foto_capa_url"                    text,
  "formas_pagamento_aceitas"         text[]                   NOT NULL DEFAULT ARRAY['PIX'::text],
  "largura_papel_impressao"          smallint                 NOT NULL DEFAULT 80,
  CONSTRAINT "restaurantes_formas_pagamento_validas"
    CHECK (((cardinality(formas_pagamento_aceitas) > 0) AND (formas_pagamento_aceitas <@ ARRAY['PIX'::text, 'CARTAO_CREDITO'::text, 'CARTAO_DEBITO'::text, 'CARTAO'::text]))),
  CONSTRAINT "restaurantes_largura_papel_impressao_check" CHECK ((largura_papel_impressao = ANY (ARRAY[58, 80]))),
  CONSTRAINT "restaurantes_pkey" PRIMARY KEY (id),
  CONSTRAINT "restaurantes_slug_key" UNIQUE (slug),
  CONSTRAINT "restaurantes_tipo_check"
    CHECK
    (((tipo)::text = ANY ((ARRAY['ACAITERIA'::character varying, 'HAMBURGUERIA'::character varying, 'PIZZARIA'::character varying, 'RESTAURANTE_TRADICIONAL'::character varying,
    'CAFETERIA_DOCERIA'::character varying,
    'SORVETERIA'::character varying,
    'SUSHI_BAR'::character varying, 'FITNESS_SAUDAVEL'::character varying, 'PASTELARIA'::character varying, 'ESPETARIA'::character varying])::text[])))
);

ALTER TABLE "public"."restaurantes"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.deduzir_estoque_insumo (
  p_insumo_id  uuid,
  p_quantidade numeric
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
    update insumos
    set estoque_atual = estoque_atual - p_quantidade
    where id = p_insumo_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.definir_numero_pedido()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.incrementar_checkout_funil (
  p_restaurante_id uuid,
  p_data           date
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
    insert into metricas_funil (restaurante_id, data, checkouts_iniciados)
    values (p_restaurante_id, p_data, 1)
    on conflict (restaurante_id, data)
    do update set checkouts_iniciados = metricas_funil.checkouts_iniciados + 1;
end;
$function$;

CREATE OR REPLACE FUNCTION public.incrementar_compras_funil (
  p_restaurante_id uuid,
  p_data           date
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
    insert into metricas_funil (restaurante_id, data, compras_concluidas)
    values (p_restaurante_id, p_data, 1)
    on conflict (restaurante_id, data)
    do update set compras_concluidas = metricas_funil.compras_concluidas + 1;
end;
$function$;

CREATE OR REPLACE FUNCTION public.incrementar_visitas_funil (
  p_restaurante_id uuid,
  p_data           date
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
    insert into metricas_funil (restaurante_id, data, visitas_cardapio)
    values (p_restaurante_id, p_data, 1)
    on conflict (restaurante_id, data)
    do update set visitas_cardapio = metricas_funil.visitas_cardapio + 1;
end;
$function$;

CREATE OR REPLACE FUNCTION public.restaurante_id_do_gestor_logado()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  AS $function$
    select restaurante_id from perfis_admin where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

ALTER TABLE "public"."composicao_produto"
  ADD CONSTRAINT "composicao_produto_insumo_id_fkey" FOREIGN KEY (insumo_id) REFERENCES public.insumos(id) ON DELETE CASCADE;

ALTER TABLE "public"."complementos_produto"
  ADD CONSTRAINT "complementos_produto_item_cardapio_id_fkey" FOREIGN KEY (item_cardapio_id) REFERENCES public.itens_cardapio(id) ON DELETE CASCADE;

ALTER TABLE "public"."composicao_produto"
  ADD CONSTRAINT "composicao_produto_item_cardapio_id_fkey" FOREIGN KEY (item_cardapio_id) REFERENCES public.itens_cardapio(id) ON DELETE CASCADE;

ALTER TABLE "public"."itens_pedido"
  ADD CONSTRAINT "itens_pedido_item_cardapio_id_fkey" FOREIGN KEY (item_cardapio_id) REFERENCES public.itens_cardapio(id);

ALTER TABLE "public"."itens_pedido_complementos"
  ADD CONSTRAINT "itens_pedido_complementos_complemento_produto_id_fkey" FOREIGN KEY (complemento_produto_id) REFERENCES public.complementos_produto(id) ON DELETE SET NULL;

ALTER TABLE "public"."itens_pedido_complementos"
  ADD CONSTRAINT "itens_pedido_complementos_item_pedido_id_fkey" FOREIGN KEY (item_pedido_id) REFERENCES public.itens_pedido(id) ON DELETE CASCADE;

ALTER TABLE "public"."pedidos"
  ADD CONSTRAINT "pedidos_entregador_id_fkey" FOREIGN KEY (entregador_id) REFERENCES public.entregadores(id) ON DELETE SET NULL;

ALTER TABLE "public"."eventos_ifood"
  ADD CONSTRAINT "eventos_ifood_pedido_id_fkey" FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE SET NULL;

ALTER TABLE "public"."itens_pedido"
  ADD CONSTRAINT "itens_pedido_pedido_id_fkey" FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE;

ALTER TABLE "public"."notificacoes_pedido"
  ADD CONSTRAINT "notificacoes_pedido_pedido_id_fkey" FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE;

ALTER TABLE "public"."perfis_admin"
  ADD CONSTRAINT "perfis_admin_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."push_subscriptions_pedido"
  ADD CONSTRAINT "push_subscriptions_pedido_pedido_id_fkey" FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE;

ALTER TABLE "public"."assinaturas_plataforma"
  ADD CONSTRAINT "assinaturas_plataforma_restaurante_id_fkey" FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE CASCADE;

ALTER TABLE "public"."entregadores"
  ADD CONSTRAINT "entregadores_restaurante_id_fkey" FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE CASCADE;

ALTER TABLE "public"."eventos_ifood"
  ADD CONSTRAINT "eventos_ifood_restaurante_id_fkey" FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE CASCADE;

ALTER TABLE "public"."insumos"
  ADD CONSTRAINT "insumos_restaurante_id_fkey" FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE CASCADE;

ALTER TABLE "public"."itens_cardapio"
  ADD CONSTRAINT "itens_cardapio_restaurante_id_fkey" FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE CASCADE;

ALTER TABLE "public"."logs_webhook_pagamentos"
  ADD CONSTRAINT "logs_webhook_pagamentos_restaurante_id_fkey" FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE SET NULL;

ALTER TABLE "public"."metricas_funil"
  ADD CONSTRAINT "metricas_funil_restaurante_id_fkey" FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE CASCADE;

ALTER TABLE "public"."metricas_meta_ads_diarias"
  ADD CONSTRAINT "metricas_meta_ads_diarias_restaurante_id_fkey" FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE CASCADE;

ALTER TABLE "public"."pedidos"
  ADD CONSTRAINT "pedidos_restaurante_id_fkey" FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE CASCADE;

ALTER TABLE "public"."perfis_admin"
  ADD CONSTRAINT "perfis_admin_restaurante_id_fkey" FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE CASCADE;

ALTER TABLE "public"."public_clientes"
  ADD CONSTRAINT "public_clientes_restaurante_id_fkey" FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE CASCADE;

ALTER TABLE "public"."restaurante_integracoes_ifood"
  ADD CONSTRAINT "restaurante_integracoes_ifood_restaurante_id_fkey" FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE CASCADE;

ALTER TABLE "public"."restaurante_integracoes_meta_ads"
  ADD CONSTRAINT "restaurante_integracoes_meta_ads_restaurante_id_fkey" FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE CASCADE;

ALTER TABLE "public"."restaurante_integracoes_pagamento"
  ADD CONSTRAINT "restaurante_integracoes_pagamento_restaurante_id_fkey" FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE CASCADE;

ALTER TABLE "public"."restaurante_integracoes_whatsapp_business"
  ADD CONSTRAINT "restaurante_integracoes_whatsapp_business_restaurante_id_fkey" FOREIGN KEY (restaurante_id) REFERENCES public.restaurantes(id) ON DELETE CASCADE;

CREATE INDEX eventos_ifood_pedido_idx ON public.eventos_ifood USING btree (pedido_id);

CREATE INDEX idx_assinaturas_plataforma_restaurante_id ON public.assinaturas_plataforma USING btree (restaurante_id);

CREATE INDEX idx_complementos_produto_item_cardapio_id ON public.complementos_produto USING btree (item_cardapio_id);

CREATE INDEX idx_composicao_produto_insumo_id ON public.composicao_produto USING btree (insumo_id);

CREATE INDEX idx_composicao_produto_item_cardapio_id ON public.composicao_produto USING btree (item_cardapio_id);

CREATE INDEX idx_entregadores_restaurante_id ON public.entregadores USING btree (restaurante_id);

CREATE INDEX idx_insumos_restaurante_id ON public.insumos USING btree (restaurante_id);

CREATE INDEX idx_itens_cardapio_restaurante_id ON public.itens_cardapio USING btree (restaurante_id);

CREATE INDEX idx_itens_cardapio_vitrine ON public.itens_cardapio USING btree (restaurante_id, arquivado, disponivel, ordem);

CREATE INDEX idx_itens_pedido_complementos_item_pedido_id ON public.itens_pedido_complementos USING btree (item_pedido_id);

CREATE INDEX idx_itens_pedido_pedido_id ON public.itens_pedido USING btree (pedido_id);

CREATE INDEX idx_logs_webhook_pagamentos_correlacao ON public.logs_webhook_pagamentos USING btree (id_correlacao);

CREATE INDEX idx_logs_webhook_pagamentos_restaurante_id ON public.logs_webhook_pagamentos USING btree (restaurante_id);

CREATE INDEX idx_metricas_funil_restaurante_id ON public.metricas_funil USING btree (restaurante_id);

CREATE INDEX idx_metricas_meta_ads_restaurante_id ON public.metricas_meta_ads_diarias USING btree (restaurante_id);

CREATE INDEX idx_notificacoes_pedido_pedido_id ON public.notificacoes_pedido USING btree (pedido_id, canal, status_destino);

CREATE INDEX idx_pedidos_entregador_id_status ON public.pedidos USING btree (entregador_id, status);

CREATE INDEX idx_pedidos_restaurante_id_status ON public.pedidos USING btree (restaurante_id, status);

CREATE INDEX idx_pedidos_sem_entregador ON public.pedidos USING btree (restaurante_id, status)
  WHERE (entregador_id IS NULL);

CREATE INDEX idx_perfis_admin_restaurante_id ON public.perfis_admin USING btree (restaurante_id);

CREATE INDEX idx_public_clientes_restaurante_id ON public.public_clientes USING btree (restaurante_id);

CREATE INDEX idx_push_subscriptions_pedido_id ON public.push_subscriptions_pedido USING btree (pedido_id);

CREATE INDEX idx_restaurantes_gateway_customer_id ON public.restaurantes USING btree (gateway_customer_id);

CREATE INDEX itens_cardapio_categoria_idx ON public.itens_cardapio USING btree (categoria);

CREATE INDEX itens_cardapio_dia_semana_idx ON public.itens_cardapio USING btree (dia_semana);

CREATE UNIQUE INDEX pedidos_ifood_order_id_idx ON public.pedidos USING btree (ifood_order_id)
  WHERE (ifood_order_id IS NOT NULL);

CREATE INDEX pedidos_restaurante_created_at_idx ON public.pedidos USING btree (restaurante_id, created_at);

CREATE INDEX pedidos_restaurante_status_idx ON public.pedidos USING btree (restaurante_id, status);

CREATE UNIQUE INDEX restaurante_integracoes_ifood_merchant_conectado_idx ON public.restaurante_integracoes_ifood USING btree (merchant_id)
  WHERE (connection_status = 'conectado'::text);

CREATE TRIGGER trg_definir_numero_pedido
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.definir_numero_pedido();

CREATE POLICY "complementos_produto_gestor" ON "public"."complementos_produto"
  FOR ALL
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.itens_cardapio ic
  WHERE ((ic.id = complementos_produto.item_cardapio_id) AND (ic.restaurante_id = public.restaurante_id_do_gestor_logado())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.itens_cardapio ic
  WHERE ((ic.id = complementos_produto.item_cardapio_id) AND (ic.restaurante_id = public.restaurante_id_do_gestor_logado())))));

CREATE POLICY "complementos_produto_select_publico" ON "public"."complementos_produto"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "composicao_produto_gestor" ON "public"."composicao_produto"
  FOR ALL
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.itens_cardapio ic
  WHERE ((ic.id = composicao_produto.item_cardapio_id) AND (ic.restaurante_id = public.restaurante_id_do_gestor_logado())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.itens_cardapio ic
  WHERE ((ic.id = composicao_produto.item_cardapio_id) AND (ic.restaurante_id = public.restaurante_id_do_gestor_logado())))));

CREATE POLICY "entregadores_select_gestor" ON "public"."entregadores"
  FOR SELECT
  TO "authenticated"
  USING ((restaurante_id = public.restaurante_id_do_gestor_logado()));

CREATE POLICY "insumos_gestor" ON "public"."insumos"
  FOR ALL
  TO "authenticated"
  USING ((restaurante_id = public.restaurante_id_do_gestor_logado()))
  WITH CHECK ((restaurante_id = public.restaurante_id_do_gestor_logado()));

CREATE POLICY "itens_cardapio_gestor" ON "public"."itens_cardapio"
  FOR ALL
  TO "authenticated"
  USING ((restaurante_id = public.restaurante_id_do_gestor_logado()))
  WITH CHECK ((restaurante_id = public.restaurante_id_do_gestor_logado()));

CREATE POLICY "itens_cardapio_select_publico" ON "public"."itens_cardapio"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "itens_pedido_select_gestor" ON "public"."itens_pedido"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.pedidos p
  WHERE ((p.id = itens_pedido.pedido_id) AND (p.restaurante_id = public.restaurante_id_do_gestor_logado())))));

CREATE POLICY "itens_pedido_complementos_select_gestor" ON "public"."itens_pedido_complementos"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.itens_pedido ip
     JOIN public.pedidos p ON ((p.id = ip.pedido_id)))
  WHERE ((ip.id = itens_pedido_complementos.item_pedido_id) AND (p.restaurante_id = public.restaurante_id_do_gestor_logado())))));

CREATE POLICY "metricas_funil_select_gestor" ON "public"."metricas_funil"
  FOR SELECT
  TO "authenticated"
  USING ((restaurante_id = public.restaurante_id_do_gestor_logado()));

CREATE POLICY "pedidos_select_gestor" ON "public"."pedidos"
  FOR SELECT
  TO "authenticated"
  USING ((restaurante_id = public.restaurante_id_do_gestor_logado()));

CREATE POLICY "perfis_admin_select_proprio" ON "public"."perfis_admin"
  FOR SELECT
  TO "authenticated"
  USING ((id = auth.uid()));

CREATE POLICY "restaurantes_select_publico" ON "public"."restaurantes"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "restaurantes_update_proprio" ON "public"."restaurantes"
  FOR UPDATE
  TO "authenticated"
  USING ((id = public.restaurante_id_do_gestor_logado()))
  WITH CHECK ((id = public.restaurante_id_do_gestor_logado()));

CREATE POLICY "Atualizacao autenticada no bucket produtos" ON "storage"."objects"
  FOR UPDATE
  TO "authenticated"
  USING ((bucket_id = 'produtos'::text));

CREATE POLICY "Leitura publica do bucket produtos" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'produtos'::text));

CREATE POLICY "Remocao autenticada no bucket produtos" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING ((bucket_id = 'produtos'::text));

CREATE POLICY "Upload autenticado no bucket produtos" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((bucket_id = 'produtos'::text));

CREATE EVENT TRIGGER "ensure_rls"
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION "public"."rls_auto_enable"();

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."pedidos";

COMMENT ON COLUMN "public"."itens_cardapio"."categoria" IS 'Categoria estrutural do item (ex.: Pratos, Acompanhamentos, Bebidas, Sobremesas). Texto livre, opcional.';

COMMENT ON COLUMN "public"."itens_cardapio"."dia_semana" IS 'Dia da semana em que o item fica disponível para pedido (0=Domingo .. 6=Sábado). NULL = disponível todos os dias.';

COMMENT ON TABLE "public"."pedidos" IS 'Isolamento multi-tenant feito 100% na aplicação (sem RLS) — ver checklist.';

COMMENT ON TABLE "public"."perfis_admin" IS 'id = auth.users.id do gestor logado; restaurante_id = loja que ele administra.';

COMMENT ON TABLE "public"."restaurantes" IS 'Tenant raiz: cada loja cadastrada na plataforma.';

GRANT EXECUTE ON FUNCTION "public"."deduzir_estoque_insumo"(uuid, numeric) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."deduzir_estoque_insumo"(uuid, numeric) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."deduzir_estoque_insumo"(uuid, numeric) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."deduzir_estoque_insumo"(uuid, numeric) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."definir_numero_pedido"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."definir_numero_pedido"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."definir_numero_pedido"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."definir_numero_pedido"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."incrementar_checkout_funil"(uuid, date) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."incrementar_checkout_funil"(uuid, date) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."incrementar_checkout_funil"(uuid, date) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."incrementar_checkout_funil"(uuid, date) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."incrementar_compras_funil"(uuid, date) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."incrementar_compras_funil"(uuid, date) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."incrementar_compras_funil"(uuid, date) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."incrementar_compras_funil"(uuid, date) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."incrementar_visitas_funil"(uuid, date) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."incrementar_visitas_funil"(uuid, date) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."incrementar_visitas_funil"(uuid, date) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."incrementar_visitas_funil"(uuid, date) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."restaurante_id_do_gestor_logado"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."restaurante_id_do_gestor_logado"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."restaurante_id_do_gestor_logado"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."restaurante_id_do_gestor_logado"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."assinaturas_plataforma" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."assinaturas_plataforma" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."assinaturas_plataforma" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."assinaturas_plataforma" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."complementos_produto" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."complementos_produto" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."complementos_produto" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."complementos_produto" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."composicao_produto" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."composicao_produto" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."composicao_produto" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."composicao_produto" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."entregadores" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."entregadores" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."entregadores" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."entregadores" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."eventos_ifood" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."eventos_ifood" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."eventos_ifood" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."eventos_ifood" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."eventos_webhook_stripe" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."eventos_webhook_stripe" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."eventos_webhook_stripe" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."eventos_webhook_stripe" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."insumos" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."insumos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."insumos" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."insumos" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."itens_cardapio" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."itens_cardapio" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."itens_cardapio" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."itens_cardapio" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."itens_pedido" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."itens_pedido" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."itens_pedido" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."itens_pedido" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."itens_pedido_complementos" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."itens_pedido_complementos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."itens_pedido_complementos" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."itens_pedido_complementos" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."logs_webhook_pagamentos" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."logs_webhook_pagamentos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."logs_webhook_pagamentos" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."logs_webhook_pagamentos" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."metricas_funil" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."metricas_funil" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."metricas_funil" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."metricas_funil" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."metricas_meta_ads_diarias" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."metricas_meta_ads_diarias" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."metricas_meta_ads_diarias" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."metricas_meta_ads_diarias" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notificacoes_pedido" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."notificacoes_pedido" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notificacoes_pedido" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notificacoes_pedido" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pedidos" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."pedidos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pedidos" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pedidos" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."perfis_admin" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."perfis_admin" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."perfis_admin" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."perfis_admin" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."public_clientes" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."public_clientes" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."public_clientes" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."public_clientes" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."push_subscriptions_pedido" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."push_subscriptions_pedido" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."push_subscriptions_pedido" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."push_subscriptions_pedido" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."restaurante_integracoes_ifood" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."restaurante_integracoes_ifood" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."restaurante_integracoes_ifood" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."restaurante_integracoes_ifood" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."restaurante_integracoes_meta_ads" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."restaurante_integracoes_meta_ads" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."restaurante_integracoes_meta_ads" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."restaurante_integracoes_meta_ads" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."restaurante_integracoes_pagamento" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."restaurante_integracoes_pagamento" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."restaurante_integracoes_pagamento" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."restaurante_integracoes_pagamento" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."restaurante_integracoes_whatsapp_business" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."restaurante_integracoes_whatsapp_business" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."restaurante_integracoes_whatsapp_business" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."restaurante_integracoes_whatsapp_business" TO "service_role";

REVOKE ALL ON TABLE "public"."restaurantes" FROM "anon";

REVOKE ALL ("created_at") ON TABLE "public"."restaurantes" FROM "anon";

GRANT SELECT ("created_at") ON TABLE "public"."restaurantes" TO "anon";

REVOKE ALL ("endereco") ON TABLE "public"."restaurantes" FROM "anon";

GRANT SELECT ("endereco") ON TABLE "public"."restaurantes" TO "anon";

REVOKE ALL ("foto_capa_url") ON TABLE "public"."restaurantes" FROM "anon";

GRANT SELECT ("foto_capa_url") ON TABLE "public"."restaurantes" TO "anon";

REVOKE ALL ("horarios_funcionamento") ON TABLE "public"."restaurantes" FROM "anon";

GRANT SELECT ("horarios_funcionamento") ON TABLE "public"."restaurantes" TO "anon";

REVOKE ALL ("id") ON TABLE "public"."restaurantes" FROM "anon";

GRANT SELECT ("id") ON TABLE "public"."restaurantes" TO "anon";

REVOKE ALL ("latitude") ON TABLE "public"."restaurantes" FROM "anon";

GRANT SELECT ("latitude") ON TABLE "public"."restaurantes" TO "anon";

REVOKE ALL ("logo_url") ON TABLE "public"."restaurantes" FROM "anon";

GRANT SELECT ("logo_url") ON TABLE "public"."restaurantes" TO "anon";

REVOKE ALL ("longitude") ON TABLE "public"."restaurantes" FROM "anon";

GRANT SELECT ("longitude") ON TABLE "public"."restaurantes" TO "anon";

REVOKE ALL ("meta_pixel_id") ON TABLE "public"."restaurantes" FROM "anon";

GRANT SELECT ("meta_pixel_id") ON TABLE "public"."restaurantes" TO "anon";

REVOKE ALL ("nome") ON TABLE "public"."restaurantes" FROM "anon";

GRANT SELECT ("nome") ON TABLE "public"."restaurantes" TO "anon";

REVOKE ALL ("slug") ON TABLE "public"."restaurantes" FROM "anon";

GRANT SELECT ("slug") ON TABLE "public"."restaurantes" TO "anon";

REVOKE ALL ("status_assinatura") ON TABLE "public"."restaurantes" FROM "anon";

GRANT SELECT ("status_assinatura") ON TABLE "public"."restaurantes" TO "anon";

REVOKE ALL ("tempo_preparo_base_minutos") ON TABLE "public"."restaurantes" FROM "anon";

GRANT SELECT ("tempo_preparo_base_minutos") ON TABLE "public"."restaurantes" TO "anon";

REVOKE ALL ("tempo_preparo_incremento_minutos") ON TABLE "public"."restaurantes" FROM "anon";

GRANT SELECT ("tempo_preparo_incremento_minutos") ON TABLE "public"."restaurantes" TO "anon";

REVOKE ALL ("tempo_preparo_teto_minutos") ON TABLE "public"."restaurantes" FROM "anon";

GRANT SELECT ("tempo_preparo_teto_minutos") ON TABLE "public"."restaurantes" TO "anon";

REVOKE ALL ("tipo") ON TABLE "public"."restaurantes" FROM "anon";

GRANT SELECT ("tipo") ON TABLE "public"."restaurantes" TO "anon";

REVOKE ALL ON TABLE "public"."restaurantes" FROM "authenticated";

REVOKE ALL ("created_at") ON TABLE "public"."restaurantes" FROM "authenticated";

GRANT SELECT ("created_at") ON TABLE "public"."restaurantes" TO "authenticated";

REVOKE ALL ("endereco") ON TABLE "public"."restaurantes" FROM "authenticated";

GRANT SELECT ("endereco"), UPDATE ("endereco") ON TABLE "public"."restaurantes" TO "authenticated";

REVOKE ALL ("foto_capa_url") ON TABLE "public"."restaurantes" FROM "authenticated";

GRANT SELECT ("foto_capa_url") ON TABLE "public"."restaurantes" TO "authenticated";

REVOKE ALL ("horarios_funcionamento") ON TABLE "public"."restaurantes" FROM "authenticated";

GRANT SELECT ("horarios_funcionamento"), UPDATE ("horarios_funcionamento") ON TABLE "public"."restaurantes" TO "authenticated";

REVOKE ALL ("id") ON TABLE "public"."restaurantes" FROM "authenticated";

GRANT SELECT ("id") ON TABLE "public"."restaurantes" TO "authenticated";

REVOKE ALL ("latitude") ON TABLE "public"."restaurantes" FROM "authenticated";

GRANT SELECT ("latitude"), UPDATE ("latitude") ON TABLE "public"."restaurantes" TO "authenticated";

REVOKE ALL ("logo_url") ON TABLE "public"."restaurantes" FROM "authenticated";

GRANT SELECT ("logo_url") ON TABLE "public"."restaurantes" TO "authenticated";

REVOKE ALL ("longitude") ON TABLE "public"."restaurantes" FROM "authenticated";

GRANT SELECT ("longitude"), UPDATE ("longitude") ON TABLE "public"."restaurantes" TO "authenticated";

REVOKE ALL ("meta_pixel_id") ON TABLE "public"."restaurantes" FROM "authenticated";

GRANT SELECT ("meta_pixel_id"), UPDATE ("meta_pixel_id") ON TABLE "public"."restaurantes" TO "authenticated";

REVOKE ALL ("nome") ON TABLE "public"."restaurantes" FROM "authenticated";

GRANT SELECT ("nome") ON TABLE "public"."restaurantes" TO "authenticated";

REVOKE ALL ("slug") ON TABLE "public"."restaurantes" FROM "authenticated";

GRANT SELECT ("slug") ON TABLE "public"."restaurantes" TO "authenticated";

REVOKE ALL ("status_assinatura") ON TABLE "public"."restaurantes" FROM "authenticated";

GRANT SELECT ("status_assinatura") ON TABLE "public"."restaurantes" TO "authenticated";

REVOKE ALL ("tempo_preparo_base_minutos") ON TABLE "public"."restaurantes" FROM "authenticated";

GRANT SELECT ("tempo_preparo_base_minutos"), UPDATE ("tempo_preparo_base_minutos") ON TABLE "public"."restaurantes" TO "authenticated";

REVOKE ALL ("tempo_preparo_incremento_minutos") ON TABLE "public"."restaurantes" FROM "authenticated";

GRANT SELECT ("tempo_preparo_incremento_minutos"), UPDATE ("tempo_preparo_incremento_minutos") ON TABLE "public"."restaurantes" TO "authenticated";

REVOKE ALL ("tempo_preparo_teto_minutos") ON TABLE "public"."restaurantes" FROM "authenticated";

GRANT SELECT ("tempo_preparo_teto_minutos"), UPDATE ("tempo_preparo_teto_minutos") ON TABLE "public"."restaurantes" TO "authenticated";

REVOKE ALL ("tipo") ON TABLE "public"."restaurantes" FROM "authenticated";

GRANT SELECT ("tipo") ON TABLE "public"."restaurantes" TO "authenticated";

REVOKE ALL ON TABLE "public"."restaurantes" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."restaurantes" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."restaurantes" TO "service_role";

