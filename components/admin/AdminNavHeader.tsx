'use client';

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { APP_BRAND_NAME } from '@/utils/branding';
import { logout } from '@/actions/auth';

type AdminTab =
  | 'produtos'
  | 'insumos'
  | 'estoque'
  | 'cozinha'
  | 'metricas'
  | 'integracoes'
  | 'ia'
  | 'configuracoes'
  | 'entregadores';

interface AdminNavHeaderProps {
  activeTab: AdminTab;
  brandActions?: ReactNode;
  showAccountActions?: boolean;
}

interface NavItem {
  id: AdminTab;
  href: string;
  label: string;
  icon: ReactNode;
  destaque?: boolean;
  desabilitado?: boolean;
}

const navItems: NavItem[] = [
  {
    id: 'ia',
    href: '/admin/ia',
    label: 'IA Insights',
    destaque: true,
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v4m0 10v4M3 12h4m10 0h4M5.64 5.64l2.83 2.83m7.06 7.06l2.83 2.83m0-12.72l-2.83 2.83m-7.06 7.06l-2.83 2.83" />
      </svg>
    ),
  },
  {
    id: 'metricas',
    href: '/admin/metricas',
    label: 'Métricas',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    id: 'cozinha',
    href: '/admin/cozinha',
    label: 'Cozinha',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    id: 'produtos',
    href: '/admin/produtos',
    label: 'Cardápio',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    id: 'insumos',
    href: '/admin/insumos',
    label: 'Insumos',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: 'integracoes',
    href: '/admin/integracoes',
    label: 'Pagamentos e Integrações',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M3 6h18a.75.75 0 01.75.75v10.5A2.25 2.25 0 0119.5 19.5h-15A2.25 2.25 0 012.25 17.25V6.75A.75.75 0 013 6z" />
      </svg>
    ),
  },
  {
    id: 'configuracoes',
    href: '/admin/configuracoes',
    label: 'Configurações',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.559-.94-1.109v-1.094c0-.55.398-1.02.94-1.109l.894-.15c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'entregadores',
    href: '/admin/entregadores',
    label: 'Entregadores',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM19 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM5 16.5H3v-4l2-5h9l3 5h2.5a1.5 1.5 0 011.5 1.5v2.5h-2M8 16.5h8M5 7.5V5a1 1 0 011-1h4a1 1 0 011 1v2.5" />
      </svg>
    ),
  },
  {
    id: 'estoque',
    href: '/admin/estoque',
    label: 'Estoque (em breve)',
    desabilitado: true,
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L12 3l9 4.5M3 7.5V16.5L12 21l9-4.5V7.5M3 7.5L12 12m0 9V12m0 0l9-4.5" />
      </svg>
    ),
  },
];

function classeAba(item: NavItem, isActive: boolean): string {
  if (item.desabilitado) {
    return 'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 cursor-not-allowed opacity-70 shrink-0';
  }
  if (isActive) {
    return 'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#E16349] text-white shadow-sm transition-all shrink-0';
  }
  if (item.destaque) {
    return 'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all shrink-0 hover:bg-emerald-200';
  }
  return 'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:text-[#1A1A1A] transition-all shrink-0';
}

function AbaNav({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const iconClassName = !item.desabilitado && isActive ? '' : 'text-zinc-400';

  if (item.desabilitado) {
    return (
      <span className={classeAba(item, isActive)} title="Em breve">
        <span className={iconClassName}>{item.icon}</span>
        {item.label}
      </span>
    );
  }

  return (
    <Link href={item.href} className={classeAba(item, isActive)}>
      <span className={iconClassName}>{item.icon}</span>
      {item.label}
    </Link>
  );
}

export function AdminNavHeader({ activeTab, brandActions, showAccountActions = true }: AdminNavHeaderProps) {
  const inputLogoRef = useRef<HTMLInputElement | null>(null);
  const menuContaRef = useRef<HTMLDivElement | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [carregandoLogo, setCarregandoLogo] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [menuContaAberto, setMenuContaAberto] = useState(false);

  useEffect(() => {
    if (!menuContaAberto) return;

    const handleClickFora = (event: MouseEvent) => {
      if (menuContaRef.current && !menuContaRef.current.contains(event.target as Node)) {
        setMenuContaAberto(false);
      }
    };

    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, [menuContaAberto]);

  useEffect(() => {
    let ativo = true;

    const carregarLogo = async () => {
      setCarregandoLogo(true);
      try {
        const resposta = await fetch('/api/admin/restaurante', { cache: 'no-store' });
        if (!resposta.ok) return;
        const body = await resposta.json();
        if (ativo) {
          setLogoUrl(typeof body?.logo_url === 'string' ? body.logo_url : null);
        }
      } catch (error) {
        console.error('Falha ao carregar logo do restaurante:', error);
      } finally {
        if (ativo) {
          setCarregandoLogo(false);
        }
      }
    };

    void carregarLogo();

    return () => {
      ativo = false;
    };
  }, []);

  const handleSelecionarLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    const formData = new FormData();
    formData.append('logo', arquivo);
    setEnviandoLogo(true);

    try {
      const resposta = await fetch('/api/admin/restaurante/logo', {
        method: 'POST',
        body: formData,
      });
      const body = await resposta.json();

      if (!resposta.ok) {
        throw new Error(body?.error || 'Falha ao atualizar logo.');
      }

      setLogoUrl(body?.logo_url || null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Falha ao atualizar logo.');
    } finally {
      setEnviandoLogo(false);
      event.target.value = '';
    }
  };

  const triggerInputLogo = () => {
    inputLogoRef.current?.click();
  };

  return (
    <header className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3.5 select-none">
          <button
            type="button"
            onClick={triggerInputLogo}
            disabled={enviandoLogo || carregandoLogo}
            className="group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-200/60 bg-[#F3F3F3] text-zinc-400 shadow-inner disabled:opacity-60"
            title="Editar logo"
          >
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt="Logo do restaurante"
                width={44}
                height={44}
                unoptimized
                className="h-11 w-11 rounded-full object-cover"
              />
            ) : (
              <svg className="h-5 w-5 text-[#E16349]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m0 0a3.001 3.001 0 00-3.75-.615A2.993 2.993 0 009.75 9.75c0 .358.063.702.18 1.025m10.965-1.426c.229-.112.483-.174.75-.174a1.5 1.5 0 011.5 1.5v6.75m-4.5-9a3.97 3.97 0 00-1.22-.112m-1.48 1.137A3.987 3.987 0 0112 11.25c-1.192 0-2.261-.523-3-1.362m-.75 0a3.987 3.987 0 01-3-1.362m0 0a3 3 0 00-3.75.615A2.993 2.993 0 001.5 9.75c0 .358.063.702.18 1.025m0 0A3.987 3.987 0 013 11.25c1.192 0 2.261-.523 3-1.362m0 0c.267.267.58.483.925.64" />
              </svg>
            )}
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-zinc-900/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {enviandoLogo ? (
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                </svg>
              )}
            </span>
          </button>
          <input
            ref={inputLogoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleSelecionarLogo}
          />

          <div className="leading-tight">
            <h2 className="text-lg font-bold tracking-tight text-[#1A1A1A]">{APP_BRAND_NAME}</h2>
            <span className="mt-0.5 block text-[11px] font-semibold tracking-wide text-[#E16349]">Painel Administrativo</span>
          </div>

          {showAccountActions ? (
            <div className="relative" ref={menuContaRef}>
              <button
                type="button"
                onClick={() => setMenuContaAberto((atual) => !atual)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-900"
                title="Conta"
                aria-label="Abrir menu da conta"
                aria-expanded={menuContaAberto}
              >
                <svg className={`h-3.5 w-3.5 transition-transform ${menuContaAberto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {menuContaAberto && (
                <div className="absolute left-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
                  <button
                    type="button"
                    disabled
                    title="Perfil em breve"
                    className="flex w-full cursor-not-allowed items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-zinc-400"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 0115 0" />
                    </svg>
                    Perfil (em breve)
                  </button>
                  <form action={logout} className="border-t border-zinc-100">
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 hover:text-[#E16349]"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M18 12H9m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Encerrar Sessão
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {brandActions ? <div className="flex items-center gap-2 self-start md:self-center">{brandActions}</div> : null}
      </div>

      <div className="mt-4 rounded-2xl bg-[#F3F3F3] p-1.5">
        <nav className="flex items-center gap-1 overflow-x-auto md:hidden">
          {navItems.map((item) => (
            <AbaNav key={item.id} item={item} isActive={item.id === activeTab} />
          ))}
        </nav>

        <div className="hidden md:block">
          <BarraAbasResponsiva activeTab={activeTab} />
        </div>
      </div>
    </header>
  );
}

function BarraAbasResponsiva({ activeTab }: { activeTab: AdminTab }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const medidorRef = useRef<HTMLDivElement | null>(null);
  const medidorBotaoMaisRef = useRef<HTMLButtonElement | null>(null);
  const menuMaisRef = useRef<HTMLDivElement | null>(null);
  const [larguraDisponivel, setLarguraDisponivel] = useState<number | null>(null);
  const [largurasItens, setLargurasItens] = useState<number[] | null>(null);
  const [larguraBotaoMais, setLarguraBotaoMais] = useState(0);
  const [menuMaisAberto, setMenuMaisAberto] = useState(false);

  useEffect(() => {
    const medidor = medidorRef.current;
    if (!medidor) return;
    const filhos = Array.from(medidor.children) as HTMLElement[];
    setLargurasItens(filhos.map((elemento) => elemento.offsetWidth));
    if (medidorBotaoMaisRef.current) {
      setLarguraBotaoMais(medidorBotaoMaisRef.current.offsetWidth);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entradas) => {
      const largura = entradas[0]?.contentRect.width;
      if (largura != null) setLarguraDisponivel(largura);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuMaisAberto) return;

    const handleClickFora = (event: MouseEvent) => {
      if (menuMaisRef.current && !menuMaisRef.current.contains(event.target as Node)) {
        setMenuMaisAberto(false);
      }
    };

    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, [menuMaisAberto]);

  const ESPACAMENTO = 4;

  let quantidadeVisivel = navItems.length;
  if (larguraDisponivel != null && largurasItens != null) {
    const larguraTotal = largurasItens.reduce((soma, largura) => soma + largura + ESPACAMENTO, 0);
    const precisaDeMais = larguraTotal > larguraDisponivel;
    const espacoReservado = precisaDeMais ? larguraBotaoMais + ESPACAMENTO : 0;

    let acumulado = 0;
    let cabem = 0;
    for (const largura of largurasItens) {
      acumulado += largura + ESPACAMENTO;
      if (acumulado + espacoReservado > larguraDisponivel) break;
      cabem += 1;
    }
    quantidadeVisivel = Math.max(1, cabem);
  }

  const itensVisiveis = navItems.slice(0, quantidadeVisivel);
  const itensOcultos = navItems.slice(quantidadeVisivel);

  return (
    <div ref={containerRef} className="relative flex items-center gap-1">
      {itensVisiveis.map((item) => (
        <AbaNav key={item.id} item={item} isActive={item.id === activeTab} />
      ))}

      {itensOcultos.length > 0 && (
        <div className="relative shrink-0" ref={menuMaisRef}>
          <button
            type="button"
            onClick={() => setMenuMaisAberto((atual) => !atual)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition-all ${
              itensOcultos.some((item) => item.id === activeTab)
                ? 'bg-[#E16349] font-bold text-white shadow-sm'
                : 'font-medium text-zinc-600 hover:text-[#1A1A1A]'
            }`}
            aria-expanded={menuMaisAberto}
          >
            Mais
            <svg className={`h-3 w-3 transition-transform ${menuMaisAberto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {menuMaisAberto && (
            <div className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
              {itensOcultos.map((item) => {
                const isActive = item.id === activeTab;
                const classeLinha = item.desabilitado
                  ? 'flex w-full cursor-not-allowed items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-zinc-400'
                  : `flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold transition ${
                      isActive ? 'bg-[#F3F3F3] text-[#1A1A1A]' : 'text-zinc-600 hover:bg-zinc-50 hover:text-[#1A1A1A]'
                    }`;

                if (item.desabilitado) {
                  return (
                    <span key={item.id} className={classeLinha} title="Em breve">
                      <span className="text-zinc-400">{item.icon}</span>
                      {item.label}
                    </span>
                  );
                }

                return (
                  <Link key={item.id} href={item.href} onClick={() => setMenuMaisAberto(false)} className={classeLinha}>
                    <span className="text-zinc-400">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div ref={medidorRef} className="pointer-events-none absolute left-0 top-0 flex items-center gap-1 opacity-0" style={{ zIndex: -1 }} aria-hidden>
        {navItems.map((item) => (
          <AbaNav key={item.id} item={item} isActive={false} />
        ))}
      </div>
      <button
        ref={medidorBotaoMaisRef}
        type="button"
        tabIndex={-1}
        className="pointer-events-none absolute left-0 top-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium opacity-0"
        style={{ zIndex: -1 }}
        aria-hidden
      >
        Mais
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
    </div>
  );
}
