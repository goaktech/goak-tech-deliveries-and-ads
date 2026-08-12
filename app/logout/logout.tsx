 'use client'

import { logout } from '@/actions/auth'

export function BotaoLogout() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-[#E16349]/40 hover:text-[#E16349]"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M18 12H9m0 0l3-3m-3 3l3 3" />
        </svg>
        Encerrar Sessão
      </button>
    </form>
  )
}
