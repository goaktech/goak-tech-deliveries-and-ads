'use client'

import { useFormStatus } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import { login, solicitarLinkMagico } from '@/actions/auth'

function BotaoSubmit() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="ui-button-primary"
    >
      {pending ? 'Autenticando...' : 'ACESSAR PAINEL'}
    </button>
  )
}

export function FormLogin() {
  const searchParams = useSearchParams()
  const erro = searchParams.get('error')
  const status = searchParams.get('status')

  return (
    <div className="space-y-6">
      {erro && (
        <div className="ui-feedback-error">
          {erro}
        </div>
      )}

      {status === 'link-magico-enviado' && (
        <div className="ui-feedback-success">
          Link mágico enviado. Verifique seu e-mail.
        </div>
      )}

      <form action={login} className="space-y-4">
        <div className="space-y-2">
          <label className="ui-label">
            E-mail Corporativo
          </label>
          <input
            type="email"
            name="email"
            required
            placeholder="gestor@restaurante.com"
            className="ui-input"
          />
        </div>

        <div className="space-y-2">
          <label className="ui-label">
            Senha de Acesso
          </label>
          <input
            type="password"
            name="password"
            required
            placeholder="••••••••"
            className="ui-input"
          />
        </div>

        <div className="pt-2">
          <BotaoSubmit />
        </div>
      </form>

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#E1E1E1]" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-[#F8F8F8] px-3 text-[10px] uppercase tracking-widest text-gray-400">ou</span>
        </div>
      </div>

      <form action={solicitarLinkMagico} className="space-y-3">
        <label className="ui-label">
          Entrar com link mágico
        </label>
        <input
          type="email"
          name="email"
          required
          placeholder="gestor@restaurante.com"
          className="ui-input"
        />
        <button
          type="submit"
          className="ui-button-secondary"
        >
          Receber link de acesso por e-mail
        </button>
      </form>
    </div>
  )
}
