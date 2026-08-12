'use client';

import { useEffect, useMemo, useState } from 'react';

interface AtivadorPushPedidoProps {
  trackingToken: string;
}

type EstadoPush = 'unsupported' | 'idle' | 'requesting' | 'enabled' | 'denied' | 'error';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function estaNoIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function estaRodandoComoPwaInstalado() {
  const navegadorPadrao = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navegadorPadrao.standalone === true;
}

export function AtivadorPushPedido({ trackingToken }: AtivadorPushPedidoProps) {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? '';
  const [estado, setEstado] = useState<EstadoPush>('idle');
  const [mensagem, setMensagem] = useState('');

  const suportado = useMemo(() => {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && Boolean(publicKey);
  }, [publicKey]);

  const precisaInstalarPwaNoIOS = useMemo(() => {
    return typeof window !== 'undefined' && estaNoIOS() && !estaRodandoComoPwaInstalado();
  }, []);

  useEffect(() => {
    if (!suportado) {
      return;
    }

    const sincronizarEstadoPush = async () => {
      if (Notification.permission === 'denied') {
        setEstado('denied');
        setMensagem('As notificações estão bloqueadas neste navegador.');
        return;
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        const pushSubscription = await registration?.pushManager.getSubscription();
        if (pushSubscription) {
          setEstado('enabled');
          setMensagem('Notificações do pedido ativadas neste dispositivo.');
        }
      } catch (error) {
        console.error('Falha ao verificar assinatura push existente:', error);
      }
    };

    void sincronizarEstadoPush();
  }, [suportado]);

  const ativarNotificacoes = async () => {
    if (!suportado) {
      setEstado('unsupported');
      return;
    }

    setEstado('requesting');
    setMensagem('Solicitando permissão para avisos do pedido...');

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        setEstado(permission === 'denied' ? 'denied' : 'idle');
        setMensagem('Permissão de notificações não concedida.');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const resposta = await fetch('/api/pedidos/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: trackingToken, subscription }),
      });

      const body = await resposta.json();
      if (!resposta.ok) {
        throw new Error(body?.error || 'Falha ao registrar assinatura push.');
      }

      setEstado('enabled');
      setMensagem('Notificações ativadas. Você receberá atualizações do pedido aqui.');
    } catch (error) {
      console.error('Falha ao ativar notificações push:', error);
      setEstado('error');
      setMensagem(error instanceof Error ? error.message : 'Falha ao ativar notificações.');
    }
  };

  if (!suportado) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-500">
        Push indisponível neste dispositivo ou sem chave pública configurada.
      </div>
    );
  }

  if (precisaInstalarPwaNoIOS) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">Instale o site para ativar as notificações</p>
        <p className="mt-1 text-xs text-amber-800">
          No iPhone, as notificações só funcionam depois de adicionar este site à Tela de Início: toque no botão
          Compartilhar do Safari, escolha &quot;Adicionar à Tela de Início&quot; e abra o app pelo ícone criado. Depois
          disso, volte aqui para ativar as notificações do pedido.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Notificações no navegador</p>
          <p className="mt-1 text-xs text-zinc-500">
            Ative para receber avisos quando o pedido mudar de etapa.
          </p>
        </div>
        <button
          type="button"
          onClick={ativarNotificacoes}
          disabled={estado === 'requesting' || estado === 'enabled'}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {estado === 'enabled' ? 'Push ativado' : estado === 'requesting' ? 'Ativando...' : 'Ativar push'}
        </button>
      </div>
      {mensagem ? <p className="mt-3 text-xs text-zinc-500">{mensagem}</p> : null}
    </div>
  );
}
