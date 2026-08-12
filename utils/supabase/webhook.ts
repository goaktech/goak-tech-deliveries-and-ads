import { createClient } from '@supabase/supabase-js'

export function createWebhookAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Configuração Supabase incompleta para webhook administrativo.')
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey
  )
}
