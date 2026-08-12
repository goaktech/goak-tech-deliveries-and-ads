import { Suspense } from 'react'
import { FormLogin } from './form-cliente'

export default function LoginPage() {
  return (
    <main className="min-h-screen w-full bg-[#F8F8F8] p-6 font-sans text-[#1A1A1A] selection:bg-[#E16349] selection:text-white md:p-12">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-12 md:items-stretch">
        <section className="ui-card-soft flex min-h-[320px] flex-col justify-between p-8 md:col-span-7 md:min-h-[500px] md:p-12">
          <div>
            <span className="mb-4 block text-xs font-semibold uppercase tracking-[0.2em] text-[#E16349]">
              Intelligence System v1.0
            </span>
            <h1 className="max-w-md text-3xl font-light leading-[1.15] tracking-tight text-[#1A1A1A] md:text-4xl">
              O controle atômico da sua <span className="font-semibold text-black">lucratividade real</span>.
            </h1>
          </div>
          
          <div className="grid grid-cols-1 gap-6 border-t border-zinc-300/70 pt-8 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Métricas diretas</p>
              <p className="text-sm text-[#1A1A1A]">Cruzamento automatizado de CPA (Meta Ads) com CMV real.</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Velocidade absoluta</p>
              <p className="text-sm text-[#1A1A1A]">Arquitetura estática rodando sobre infraestrutura isolada.</p>
            </div>
          </div>
        </section>

        <section className="ui-card flex flex-col justify-center p-8 md:col-span-5 md:p-10">
          <div className="mb-8">
            <h2 className="mb-1 text-xl font-semibold tracking-tight text-black">
              Painel do Gestor
            </h2>
            <p className="text-xs tracking-wide text-zinc-500">
              Insira suas credenciais para acessar o terminal.
            </p>
          </div>

          <Suspense fallback={<div className="text-xs text-center text-gray-400">Iniciando canais de segurança...</div>}>
            <FormLogin />
          </Suspense>

          <div className="mt-8 text-center">
            <a href="#" className="text-[11px] font-medium uppercase tracking-widest text-zinc-400 transition-colors duration-200 hover:text-[#E16349]">
              Recuperar credenciais de acesso
            </a>
          </div>
        </section>

      </div>
    </main>
  )
}
