'use client';

import { FormEvent, useState } from 'react';

export function FormAssinatura() {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCarregando(true);
    setErro(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      nomeRestaurante: String(formData.get('nome_restaurante') ?? '').trim(),
      emailAdmin: String(formData.get('email_admin') ?? '').trim(),
      tipoRestaurante: String(formData.get('tipo_restaurante') ?? 'restaurante').trim(),
      slugSugerido: String(formData.get('slug_sugerido') ?? '').trim(),
    };

    try {
      const response = await fetch('/api/assinaturas/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await response.json();
      if (!response.ok || !body?.checkoutUrl) {
        throw new Error(body?.error || 'Falha ao iniciar checkout da assinatura.');
      }

      window.location.href = body.checkoutUrl;
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : 'Falha ao iniciar checkout da assinatura.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {erro ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </div>
      ) : null}

      <div className="space-y-1">
        <label htmlFor="nome_restaurante" className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Nome do restaurante
        </label>
        <input
          id="nome_restaurante"
          name="nome_restaurante"
          required
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#E16349]"
          placeholder="Ex.: Burgão da Vila"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="email_admin" className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          E-mail do gestor
        </label>
        <input
          id="email_admin"
          name="email_admin"
          type="email"
          required
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#E16349]"
          placeholder="gestor@restaurante.com"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="tipo_restaurante" className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Segmento
          </label>
          <input
            id="tipo_restaurante"
            name="tipo_restaurante"
            defaultValue="restaurante"
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#E16349]"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="slug_sugerido" className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Slug desejado
          </label>
          <input
            id="slug_sugerido"
            name="slug_sugerido"
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#E16349]"
            placeholder="burgao-da-vila"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={carregando}
        className="w-full rounded-2xl bg-[#E16349] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#cf553d] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {carregando ? 'Redirecionando...' : 'Ir para checkout seguro'}
      </button>
    </form>
  );
}
