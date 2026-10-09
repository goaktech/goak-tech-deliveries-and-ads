/** Aparece na hora ao trocar de aba, enquanto o servidor monta a página. */
export function EsqueletoPaginaAdmin() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div className="animate-pulse space-y-5 rounded-[24px] bg-white p-6 shadow-sm shadow-zinc-300/40">
        <div className="space-y-2">
          <div className="h-6 w-1/3 rounded-lg bg-zinc-200" />
          <div className="h-3.5 w-2/3 rounded-lg bg-zinc-100" />
        </div>
        <div className="h-20 rounded-2xl bg-zinc-100" />
        <div className="h-32 rounded-2xl bg-zinc-100" />
        <div className="h-32 rounded-2xl bg-zinc-100" />
      </div>
    </div>
  );
}
