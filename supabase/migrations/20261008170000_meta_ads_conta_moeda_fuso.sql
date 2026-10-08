-- Meta Ads: guarda moeda e fuso horário da conta de anúncios escolhida.
-- Usados para (1) calcular o "hoje" no fuso da conta e (2) exibir valores na moeda correta.
-- Migration aditiva: colunas anuláveis, sem alterar nem apagar nada existente.
ALTER TABLE public.restaurante_integracoes_meta_ads
  ADD COLUMN IF NOT EXISTS ad_account_currency text,
  ADD COLUMN IF NOT EXISTS ad_account_timezone text;
