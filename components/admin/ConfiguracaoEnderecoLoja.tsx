'use client';

import { useState } from 'react';
import { SeletorLocalizacaoMapa, type ResultadoLocalizacaoMapa } from '@/components/shared/SeletorLocalizacaoMapa';
import { atualizarEnderecoLoja } from '@/actions/adminConfiguracoesLoja';

interface ConfiguracaoEnderecoLojaProps {
  enderecoInicial: string;
  latitudeInicial: number | null;
  longitudeInicial: number | null;
}

export function ConfiguracaoEnderecoLoja({
  enderecoInicial,
  latitudeInicial,
  longitudeInicial,
}: ConfiguracaoEnderecoLojaProps) {
  const [endereco, setEndereco] = useState(enderecoInicial);
  const [coordenada, setCoordenada] = useState<{ latitude: number; longitude: number } | null>(
    latitudeInicial != null && longitudeInicial != null
      ? { latitude: latitudeInicial, longitude: longitudeInicial }
      : null
  );
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const handleLocalizacaoConfirmada = (resultado: ResultadoLocalizacaoMapa) => {
    setCoordenada({ latitude: resultado.latitude, longitude: resultado.longitude });
    if (resultado.endereco?.formatado) {
      setEndereco(resultado.endereco.formatado);
    }
  };

  const handleSalvar = async () => {
    setSalvando(true);
    setMensagem(null);

    const resultado = await atualizarEnderecoLoja(endereco, coordenada?.latitude ?? null, coordenada?.longitude ?? null);

    setMensagem(
      resultado.success
        ? { tipo: 'success', texto: 'Endereço da loja salvo com sucesso!' }
        : { tipo: 'error', texto: resultado.error ?? 'Falha ao salvar o endereço.' }
    );
    setSalvando(false);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 p-5 space-y-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Endereço da loja</div>
        <p className="mt-1 text-sm text-zinc-500">
          Usado para calcular distância e tempo de entrega. Marque a localização exata no mapa — quem manda pro
          cálculo é o pino, o texto abaixo é só pra conferência.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Endereço</label>
        <textarea
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-900 focus:border-zinc-400 focus:outline-none"
        />
      </div>

      <SeletorLocalizacaoMapa
        latitudeInicial={latitudeInicial}
        longitudeInicial={longitudeInicial}
        onLocalizacaoConfirmada={handleLocalizacaoConfirmada}
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

      <div className="space-y-1">
        <button
          type="button"
          onClick={handleSalvar}
          disabled={salvando || !coordenada}
          className="rounded-xl bg-zinc-900 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar endereço'}
        </button>
        {!coordenada ? <p className="text-[11px] text-zinc-400">Marque a localização no mapa antes de salvar.</p> : null}
      </div>
    </div>
  );
}
