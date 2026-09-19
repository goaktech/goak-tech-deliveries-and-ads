'use client'

import { useState } from 'react'
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
  const [mostrarSenha, setMostrarSenha] = useState(false)

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
          <label htmlFor="login-senha" className="ui-label">
            Senha de Acesso
          </label>
          <div className="relative">
            <input
              id="login-senha"
              type={mostrarSenha ? 'text' : 'password'}
              name="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="ui-input pr-14"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((atual) => !atual)}
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Ver senha'}
              aria-pressed={mostrarSenha}
              className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-zinc-500 transition hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
            >
              {mostrarSenha ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 3l18 18" />
                  <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
                  <path d="M9.36 5.37A9.77 9.77 0 0 1 12 5c5 0 8.5 4 9.5 7-.4 1.2-1.2 2.6-2.4 3.8" />
                  <path d="M6.61 6.61C4.6 7.9 3.1 9.9 2.5 12c1 3 4.5 7 9.5 7 1.5 0 2.9-.35 4.1-.95" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2.5 12C3.5 9 7 5 12 5s8.5 4 9.5 7c-1 3-4.5 7-9.5 7s-8.5-4-9.5-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
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
