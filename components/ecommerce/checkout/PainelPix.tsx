'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

interface PropsPainelPix {
  valor: number;
  qrCode: string;
  qrCodeBase64?: string;
  /** ISO 8601 de quando o QR deixa de valer; null = sem prazo conhecido. */
  expiraEm: string | null;
  gerandoNovo: boolean;
  erro?: string;
  onGerarNovo: () => void;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarContagem(ms: number) {
  const total = Math.ceil(ms / 1000);
  const minutos = Math.floor(total / 60);
  const segundos = total % 60;
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
}

export default function PainelPix({ valor, qrCode, qrCodeBase64, expiraEm, gerandoNovo, erro, onGerarNovo }: PropsPainelPix) {
  const expiraMs = expiraEm ? new Date(expiraEm).getTime() : null;
  const [agora, setAgora] = useState(() => Date.now());
  const [copiado, setCopiado] = useState(false);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const intervalo = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(intervalo);
  }, []);

  // no celular o QR nasce abaixo da dobra: leva o cliente direto até ele
  useEffect(() => {
    painelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [qrCode]);

  const restanteMs = expiraMs === null ? null : Math.max(0, expiraMs - agora);
  const expirado = restanteMs === 0;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(qrCode);
    } catch {
      campoRef.current?.select();
      document.execCommand?.('copy');
    }
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 3000);
  };

  if (expirado) {
    return (
      <div ref={painelRef} className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-bold text-amber-900">Este PIX expirou</p>
        <p className="text-xs text-amber-800">Fique tranquilo: é o mesmo pedido. Gere um novo código para pagar {formatarMoeda(valor)}.</p>
        {erro ? (
          <p role="alert" className="text-xs font-semibold text-red-700">
            {erro}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onGerarNovo}
          disabled={gerandoNovo}
          className="min-h-12 w-full rounded-xl bg-zinc-900 px-4 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
        >
          {gerandoNovo ? 'Gerando…' : 'Gerar novo PIX'}
        </button>
      </div>
    );
  }

  return (
    <div ref={painelRef} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Valor do PIX</p>
        <p className="font-mono text-3xl font-extrabold tracking-tight text-zinc-900">{formatarMoeda(valor)}</p>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>
        Aguardando o pagamento…
        {restanteMs !== null ? <span className="font-mono text-amber-900">· expira em {formatarContagem(restanteMs)}</span> : null}
      </div>

      <button
        type="button"
        onClick={() => void copiar()}
        className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold uppercase tracking-wider transition ${
          copiado ? 'bg-emerald-100 text-emerald-700' : 'bg-[#E16349] text-white hover:bg-[#c8523a]'
        }`}
      >
        {copiado ? 'Código copiado! Cole no app do seu banco' : 'Copiar código PIX (copia e cola)'}
      </button>

      {qrCodeBase64 ? (
        <div className="text-center">
          <p className="mb-2 text-[11px] font-semibold text-zinc-500">ou escaneie o QR Code com o app do banco</p>
          <Image
            src={`data:image/png;base64,${qrCodeBase64}`}
            alt="QR Code PIX"
            width={208}
            height={208}
            unoptimized
            className="mx-auto h-52 w-52 object-contain"
          />
        </div>
      ) : null}

      <textarea
        ref={campoRef}
        readOnly
        value={qrCode}
        rows={3}
        aria-label="Código PIX copia e cola"
        className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] text-zinc-600"
      />

      <ol className="space-y-1 text-xs text-zinc-500">
        <li>1. Abra o app do seu banco e escolha pagar com PIX.</li>
        <li>2. Cole o código (ou escaneie o QR Code) e confirme.</li>
        <li>3. Volte aqui: esta tela confirma sozinha, em segundos.</li>
      </ol>
    </div>
  );
}
