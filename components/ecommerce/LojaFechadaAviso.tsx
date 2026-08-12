import { NOMES_DIAS_SEMANA, type HorarioFuncionamentoDia } from '@/utils/horario-funcionamento';

interface LojaFechadaAvisoProps {
  nomeRestaurante: string;
  horarios: HorarioFuncionamentoDia[];
}

export function LojaFechadaAviso({ nomeRestaurante, horarios }: LojaFechadaAvisoProps) {
  const horariosPorDia = [...horarios].sort((a, b) => a.dia - b.dia);
  const hojeIso = new Date().getDay();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F8F8] p-6">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FBE9E4]">
          <svg className="h-7 w-7 text-[#E16349]" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <span className="mt-4 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#E16349]">Status da loja</span>
        <h1 className="mt-1 text-lg font-extrabold tracking-tight text-[#1A1A1A]">{nomeRestaurante}</h1>
        <p className="mt-1 text-sm font-semibold text-zinc-600">Estamos fechados no momento</p>
        <p className="mt-1 text-xs text-zinc-400">Confira nossos horários de funcionamento abaixo.</p>

        <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Horários</span>
          <div className="space-y-1.5">
            {horariosPorDia.map((horario) => {
              const ehHoje = horario.dia === hojeIso;
              return (
                <div
                  key={horario.dia}
                  className={`flex items-center justify-between rounded-lg px-2 py-1 text-xs ${ehHoje ? 'bg-[#FBE9E4]' : ''}`}
                >
                  <span className={`font-medium ${ehHoje ? 'text-[#E16349]' : 'text-zinc-600'}`}>
                    {NOMES_DIAS_SEMANA[horario.dia]}
                    {ehHoje && <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#E16349]">Hoje</span>}
                  </span>
                  <span className={horario.ativo ? `font-semibold ${ehHoje ? 'text-[#E16349]' : 'text-zinc-900'}` : 'text-zinc-400'}>
                    {horario.ativo ? `${horario.abertura} às ${horario.fechamento}` : 'Fechado'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
