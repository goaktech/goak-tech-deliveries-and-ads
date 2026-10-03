'use client';

import { useEffect, useState } from 'react';
import {
  atualizarDadosLojaIfood,
  concluirConexaoIfood,
  desconectarIfood,
  iniciarConexaoIfood,
} from '@/actions/adminIfood';
import { atualizarEnderecoLoja } from '@/actions/adminConfiguracoesLoja';
import type { EnderecoLojaIfood, IntegracaoIfoodPublica } from '@/utils/ifood';

interface ConfiguracaoIfoodEntregaProps {
  integracaoInicial: IntegracaoIfoodPublica | null;
  enderecoLoja: string | null;
  latitudeLoja: number | null;
  longitudeLoja: number | null;
}

type Mensagem = { tipo: 'success' | 'error'; texto: string } | null;

// Acima disso o motoboy do iFood iria a um ponto diferente do cadastrado no goak.
const DISTANCIA_ALERTA_METROS = 150;

function formatarEndereco(endereco: EnderecoLojaIfood | null) {
  if (!endereco) {
    return '';
  }
  return [endereco.logradouro, endereco.numero, endereco.bairro, endereco.cidade, endereco.estado]
    .filter(Boolean)
    .join(', ');
}

function distanciaMetros(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const raio = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * raio * Math.asin(Math.sqrt(h)));
}

const ROTULO_STATUS_LOJA: Record<string, string> = {
  AVAILABLE: 'Disponível',
  UNAVAILABLE: 'Indisponível',
  DISABLED: 'Desativada',
};

export function ConfiguracaoIfoodEntrega({
  integracaoInicial,
  enderecoLoja,
  latitudeLoja,
  longitudeLoja,
}: ConfiguracaoIfoodEntregaProps) {
  const [integracao, setIntegracao] = useState(integracaoInicial);
  const [merchantId, setMerchantId] = useState(integracaoInicial?.merchantId ?? '');
  const [codigoAutorizacao, setCodigoAutorizacao] = useState('');
  const [trocandoLoja, setTrocandoLoja] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState<Mensagem>(null);
  const [enderecoGoak, setEnderecoGoak] = useState({ endereco: enderecoLoja, latitude: latitudeLoja, longitude: longitudeLoja });
  const [agora, setAgora] = useState(() => Date.now());

  const status = integracao?.connectionStatus ?? 'desconectado';
  const aguardandoAutorizacao = status === 'pendente' && !!integracao?.userCode;
  const conectado = status === 'conectado' && !trocandoLoja;
  const expiraEm = integracao?.userCodeExpiraEm ? new Date(integracao.userCodeExpiraEm).getTime() : 0;
  const segundosRestantes = Math.max(0, Math.floor((expiraEm - agora) / 1000));

  useEffect(() => {
    if (!aguardandoAutorizacao) {
      return;
    }
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [aguardandoAutorizacao]);

  const executar = async (
    acao: () => Promise<{ success: true; integracao: IntegracaoIfoodPublica | null } | { success: false; error: string }>,
    sucesso: string
  ) => {
    setCarregando(true);
    setMensagem(null);
    const resultado = await acao();
    if (resultado.success) {
      setIntegracao(resultado.integracao);
      setMensagem({ tipo: 'success', texto: sucesso });
    } else {
      setMensagem({ tipo: 'error', texto: resultado.error });
    }
    setCarregando(false);
    return resultado.success;
  };

  const handleConectar = async () => {
    const ok = await executar(
      () => iniciarConexaoIfood(merchantId),
      'Código gerado. Agora autorize o goak no Portal do Parceiro.'
    );
    if (ok) {
      setCodigoAutorizacao('');
      setAgora(Date.now());
    }
  };

  const handleConcluir = async () => {
    const ok = await executar(() => concluirConexaoIfood(codigoAutorizacao), 'Loja iFood conectada com sucesso!');
    if (ok) {
      setTrocandoLoja(false);
      setCodigoAutorizacao('');
    }
  };

  const handleDesconectar = async () => {
    if (!window.confirm('Desconectar a loja iFood? O goak não poderá mais chamar motoboys do iFood para esta loja.')) {
      return;
    }
    await executar(desconectarIfood, 'Loja iFood desconectada.');
  };

  const enderecoIfood = integracao?.merchantEndereco ?? null;
  const coordenadasIfood =
    enderecoIfood?.latitude != null && enderecoIfood?.longitude != null
      ? { latitude: enderecoIfood.latitude, longitude: enderecoIfood.longitude }
      : null;
  const coordenadasGoak =
    enderecoGoak.latitude != null && enderecoGoak.longitude != null
      ? { latitude: enderecoGoak.latitude, longitude: enderecoGoak.longitude }
      : null;
  const distancia = coordenadasIfood && coordenadasGoak ? distanciaMetros(coordenadasIfood, coordenadasGoak) : null;
  const enderecoDivergente = !!coordenadasIfood && (distancia == null || distancia > DISTANCIA_ALERTA_METROS);

  const handleUsarEnderecoIfood = async () => {
    if (!coordenadasIfood || !enderecoIfood) {
      return;
    }
    setCarregando(true);
    setMensagem(null);
    const texto = [formatarEndereco(enderecoIfood), enderecoIfood.cep].filter(Boolean).join(', ');
    const resultado = await atualizarEnderecoLoja(texto, coordenadasIfood.latitude, coordenadasIfood.longitude);
    if (resultado.success) {
      setEnderecoGoak({ endereco: texto, ...coordenadasIfood });
      setMensagem({ tipo: 'success', texto: 'Endereço do goak atualizado com o cadastro do iFood.' });
    } else {
      setMensagem({ tipo: 'error', texto: resultado.error ?? 'Falha ao atualizar o endereço da loja.' });
    }
    setCarregando(false);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 p-5 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">iFood Entrega</div>
          <div className="text-lg font-semibold text-zinc-900">
            {conectado ? (integracao?.merchantNome ?? 'Loja conectada') : 'Loja não conectada'}
          </div>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${
            conectado ? 'border-emerald-100 bg-emerald-50 text-emerald-600' : 'border-red-100 bg-red-50 text-red-600'
          }`}
        >
          {status}
        </span>
      </div>

      {!conectado && !aguardandoAutorizacao ? (
        <>
          <p className="text-sm text-zinc-500">
            Conecte a loja do iFood para chamar motoboys do iFood Entrega direto da cozinha. A loja precisa ter o iFood
            Entrega habilitado. Copie o ID da loja no Portal do Parceiro iFood.
          </p>
          <input
            type="text"
            value={merchantId}
            onChange={(e) => setMerchantId(e.target.value)}
            placeholder="ID da loja no iFood (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)"
            className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 font-mono text-sm font-medium text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none"
          />
        </>
      ) : null}

      {aguardandoAutorizacao && !conectado ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-zinc-700">
          <div>
            Loja <span className="font-mono">{integracao?.merchantId}</span> — falta o lojista aprovar o goak no iFood.
          </div>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Abra o Portal do Parceiro com a conta <b>dona da loja</b> e aprove o código{' '}
              <span className="rounded bg-white px-2 py-0.5 font-mono text-base font-bold tracking-widest text-zinc-900">
                {integracao?.userCode}
              </span>
              {segundosRestantes > 0 ? (
                <span className="ml-2 text-xs text-zinc-500">
                  expira em {Math.floor(segundosRestantes / 60)}:{String(segundosRestantes % 60).padStart(2, '0')}
                </span>
              ) : (
                <span className="ml-2 text-xs font-bold text-red-600">expirado — gere um novo código</span>
              )}
              {integracao?.verificationUrl ? (
                <div className="pt-2">
                  <a
                    href={integracao.verificationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-xl bg-[#EA1D2C] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white"
                  >
                    Autorizar no iFood
                  </a>
                </div>
              ) : null}
            </li>
            <li>
              Copie o <b>código de autorização</b> que o iFood mostrar e cole aqui (vale 5 minutos):
              <input
                type="text"
                value={codigoAutorizacao}
                onChange={(e) => setCodigoAutorizacao(e.target.value)}
                placeholder="Código de autorização"
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 font-mono text-sm font-medium text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
            </li>
          </ol>
        </div>
      ) : null}

      {conectado ? (
        <div className="space-y-2 text-sm text-zinc-600">
          {integracao?.merchantRazaoSocial ? <div>Razão social: {integracao.merchantRazaoSocial}</div> : null}
          <div>
            ID: <span className="font-mono">{integracao?.merchantId}</span>
          </div>
          <div>
            Situação no iFood:{' '}
            <b>{ROTULO_STATUS_LOJA[integracao?.merchantStatus ?? ''] ?? integracao?.merchantStatus ?? '—'}</b>
          </div>
          <div>Endereço de coleta (cadastro iFood): {formatarEndereco(enderecoIfood) || '—'}</div>
          {integracao?.dadosAtualizadosEm ? (
            <div className="text-xs text-zinc-400">
              Dados puxados do iFood em {new Date(integracao.dadosAtualizadosEm).toLocaleString('pt-BR')}
            </div>
          ) : null}

          {enderecoDivergente ? (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-zinc-700">
              <div>
                <b>Atenção:</b> o motoboy do iFood vai buscar os pedidos no endereço cadastrado no iFood
                {distancia != null ? `, que fica a ${distancia} m do endereço configurado no goak` : ''}.
                {enderecoGoak.endereco ? ` No goak: ${enderecoGoak.endereco}.` : ' A loja ainda não tem endereço no goak.'}
              </div>
              <button
                type="button"
                onClick={handleUsarEnderecoIfood}
                disabled={carregando}
                className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-700 disabled:opacity-50"
              >
                Usar endereço do iFood no goak
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {mensagem ? (
        <div
          className={`rounded-xl px-3 py-2 text-xs font-medium ${
            mensagem.tipo === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {mensagem.texto}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 pt-2">
        {!conectado && !aguardandoAutorizacao ? (
          <button
            type="button"
            onClick={handleConectar}
            disabled={carregando || !merchantId.trim()}
            className="rounded-xl bg-zinc-900 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
          >
            {carregando ? 'Gerando código...' : 'Conectar loja iFood'}
          </button>
        ) : null}

        {aguardandoAutorizacao && !conectado ? (
          <>
            <button
              type="button"
              onClick={handleConcluir}
              disabled={carregando || !codigoAutorizacao.trim()}
              className="rounded-xl bg-zinc-900 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
            >
              {carregando ? 'Conectando...' : 'Concluir conexão'}
            </button>
            <button
              type="button"
              onClick={handleConectar}
              disabled={carregando}
              className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-zinc-700 disabled:opacity-50"
            >
              Gerar novo código
            </button>
            <button
              type="button"
              onClick={() => executar(desconectarIfood, 'Conexão cancelada.')}
              disabled={carregando}
              className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-zinc-700 disabled:opacity-50"
            >
              Cancelar
            </button>
          </>
        ) : null}

        {conectado ? (
          <>
            <button
              type="button"
              onClick={() => executar(atualizarDadosLojaIfood, 'Dados da loja atualizados.')}
              disabled={carregando}
              className="rounded-xl bg-zinc-900 px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
            >
              {carregando ? 'Atualizando...' : 'Atualizar dados'}
            </button>
            <button
              type="button"
              onClick={() => {
                setTrocandoLoja(true);
                setMerchantId('');
                setMensagem(null);
              }}
              disabled={carregando}
              className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-zinc-700 disabled:opacity-50"
            >
              Trocar loja
            </button>
            <button
              type="button"
              onClick={handleDesconectar}
              disabled={carregando}
              className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-zinc-700 disabled:opacity-50"
            >
              Desconectar
            </button>
          </>
        ) : null}

        {trocandoLoja && !aguardandoAutorizacao ? (
          <button
            type="button"
            onClick={() => {
              setTrocandoLoja(false);
              setMerchantId(integracao?.merchantId ?? '');
            }}
            className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-bold uppercase tracking-wider text-zinc-700"
          >
            Voltar
          </button>
        ) : null}
      </div>
    </div>
  );
}
