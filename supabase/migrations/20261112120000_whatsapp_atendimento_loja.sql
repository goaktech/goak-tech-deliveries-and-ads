-- WhatsApp, cenário 1: número de atendimento da loja ("Falar com a loja no WhatsApp" no acompanhamento).
-- Editável pelo gestor em Configurações. Guardado só com dígitos: DDD + número (10 ou 11) ou já com 55 (12 ou 13).
-- Quando vazio, o acompanhamento usa o número fixo de utils/config-lojas-especiais.ts (Perucho, Dona Fit), se houver.
ALTER TABLE public.restaurantes
  ADD COLUMN IF NOT EXISTS whatsapp_atendimento text;

ALTER TABLE public.restaurantes
  DROP CONSTRAINT IF EXISTS restaurantes_whatsapp_atendimento_chk;

ALTER TABLE public.restaurantes
  ADD CONSTRAINT restaurantes_whatsapp_atendimento_chk
  CHECK (whatsapp_atendimento IS NULL OR whatsapp_atendimento ~ '^[0-9]{10,13}$');
