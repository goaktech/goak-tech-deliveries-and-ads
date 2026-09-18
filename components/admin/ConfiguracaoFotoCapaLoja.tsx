'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import Image from 'next/image';

interface ConfiguracaoFotoCapaLojaProps {
  fotoCapaUrlInicial: string | null;
}

export function ConfiguracaoFotoCapaLoja({ fotoCapaUrlInicial }: ConfiguracaoFotoCapaLojaProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fotoCapaUrl, setFotoCapaUrl] = useState<string | null>(fotoCapaUrlInicial);
  const [enviando, setEnviando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const dispararSelecaoArquivo = () => {
    inputRef.current?.click();
  };

  const handleSelecionarFotoCapa = async (event: ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    const formData = new FormData();
    formData.append('fotoCapa', arquivo);
    setEnviando(true);
    setMensagem(null);

    try {
      const resposta = await fetch('/api/admin/restaurante/foto-capa', {
        method: 'POST',
        body: formData,
      });
      const body = await resposta.json();

      if (!resposta.ok) {
        throw new Error(body?.error || 'Falha ao atualizar a foto de capa.');
      }

      setFotoCapaUrl(body?.foto_capa_url || null);
      setMensagem({ tipo: 'success', texto: 'Foto de capa atualizada com sucesso!' });
    } catch (error) {
      setMensagem({
        tipo: 'error',
        texto: error instanceof Error ? error.message : 'Falha ao atualizar a foto de capa.',
      });
    } finally {
      setEnviando(false);
      event.target.value = '';
    }
  };

  const handleRemoverFotoCapa = async () => {
    setRemovendo(true);
    setMensagem(null);

    try {
      const resposta = await fetch('/api/admin/restaurante/foto-capa', { method: 'DELETE' });
      const body = await resposta.json();

      if (!resposta.ok) {
        throw new Error(body?.error || 'Falha ao remover a foto de capa.');
      }

      setFotoCapaUrl(null);
      setMensagem({ tipo: 'success', texto: 'Foto de capa removida.' });
    } catch (error) {
      setMensagem({
        tipo: 'error',
        texto: error instanceof Error ? error.message : 'Falha ao remover a foto de capa.',
      });
    } finally {
      setRemovendo(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 p-5 space-y-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Foto de capa</div>
        <p className="mt-1 text-sm text-zinc-500">
          Aparece no topo do cardápio, atrás do nome da loja. Se não cadastrar uma, o cardápio usa a foto de um
          produto em destaque no lugar dela.
        </p>
      </div>

      <div className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-xl bg-[#F3F3F3]">
        {fotoCapaUrl ? (
          <Image src={fotoCapaUrl} alt="Foto de capa da loja" fill unoptimized className="object-cover" />
        ) : (
          <span className="text-xs font-medium text-zinc-400">Nenhuma foto de capa cadastrada</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleSelecionarFotoCapa}
      />

      {mensagem ? (
        <div
          className={`rounded-xl px-3 py-2 text-xs font-medium ${
            mensagem.tipo === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {mensagem.texto}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={dispararSelecaoArquivo}
          disabled={enviando || removendo}
          className="rounded-xl bg-zinc-900 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
        >
          {enviando ? 'Enviando...' : fotoCapaUrl ? 'Trocar foto de capa' : 'Adicionar foto de capa'}
        </button>
        {fotoCapaUrl ? (
          <button
            type="button"
            onClick={handleRemoverFotoCapa}
            disabled={enviando || removendo}
            className="rounded-xl border border-zinc-200 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-zinc-600 disabled:opacity-50"
          >
            {removendo ? 'Removendo...' : 'Remover'}
          </button>
        ) : null}
      </div>
      <p className="text-[11px] text-zinc-400">PNG, JPG ou WEBP, até 7MB.</p>
    </div>
  );
}
