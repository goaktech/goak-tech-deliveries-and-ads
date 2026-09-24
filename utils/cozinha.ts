import QRCode from 'qrcode';
import type { PedidoCozinha } from '@/app/(dashboard)/admin/cozinha/useCozinha';
import type { LarguraPapelImpressao } from '@/utils/impressao';
import { formatarNumeroPedido, montarUrlLocalizacaoEntrega, obterTipoEntregaPedido } from '@/utils/pedido-status';

export function rotuloNumeroPedido(pedido: Pick<PedidoCozinha, 'numero_pedido' | 'id'>) {
  return `#${formatarNumeroPedido(pedido.numero_pedido, pedido.id)}`;
}

export type NivelAtrasoPedido = 'normal' | 'atencao' | 'atrasado';

export function formatarMoedaCozinha(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarTelefoneCozinha(telefone?: string | null) {
  const digitos = String(telefone ?? '').replace(/\D/g, '');
  const local = digitos.length > 11 && digitos.startsWith('55') ? digitos.slice(2) : digitos;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return telefone ?? '';
}

export function rotuloFormaPagamento(formaPagamento: string) {
  const forma = String(formaPagamento || '').toUpperCase();
  if (forma === 'PIX') return 'PIX';
  if (forma === 'CARTAO' || forma === 'CARTAO_CREDITO') return 'Cartão';
  if (forma === 'CARTAO_DEBITO') return 'Cartão de débito';
  return formaPagamento || 'Pagamento online';
}

function mesmoDia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatarHoraPedido(dataIso: string, agora: number) {
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return '--:--';
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const hoje = new Date(agora);
  if (mesmoDia(data, hoje)) return hora;
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  if (mesmoDia(data, ontem)) return `ontem ${hora}`;
  return `${data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`;
}

export function minutosDesde(dataIso: string, agora: number) {
  const inicio = new Date(dataIso).getTime();
  if (Number.isNaN(inicio)) return 0;
  return Math.max(0, Math.floor((agora - inicio) / 60000));
}

export function formatarDuracao(minutos: number) {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto > 0 && horas < 10 ? `${horas} h ${resto} min` : `${horas} h`;
}

export function obterNivelAtraso(pedido: PedidoCozinha, agora: number): NivelAtrasoPedido {
  const preparo = pedido.tempo_preparo_estimado_min && pedido.tempo_preparo_estimado_min > 0 ? pedido.tempo_preparo_estimado_min : 30;
  const deslocamento = pedido.status === 'SAIU_PARA_ENTREGA' ? pedido.tempo_deslocamento_min ?? 0 : 0;
  const limite = preparo + deslocamento;
  const decorrido = minutosDesde(pedido.created_at, agora);
  if (decorrido >= limite) return 'atrasado';
  if (decorrido >= limite * 0.7) return 'atencao';
  return 'normal';
}

function escaparHtml(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ConfigImpressaoComanda {
  nomeLoja: string;
  largura: LarguraPapelImpressao;
}

const ESTILOS_COMANDA: Record<LarguraPapelImpressao, string> = {
  80: `
@page{size:80mm auto;margin:4mm}
*{box-sizing:border-box}
body{margin:0;width:72mm;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.35;color:#000;overflow-wrap:anywhere}
.centro{text-align:center}
.loja{font-size:14px;font-weight:700;text-transform:uppercase}
.sep{border-top:1px dashed #000;margin:8px 0}
.topo{display:flex;justify-content:space-between;align-items:center;gap:6px}
.numero{font-size:28px;font-weight:800}
.tipo{border:2px solid #000;padding:2px 6px;font-weight:800}
.cliente{font-weight:700;text-transform:uppercase;margin-top:6px}
.item{margin-bottom:6px}
.nome-item{font-size:14px;font-weight:800}
.adicional{padding-left:18px}
.caixa{border:2px solid #000;padding:6px;margin:8px 0}
.rotulo{font-size:10px;font-weight:800}
.forte{font-weight:700}
.linha{display:flex;justify-content:space-between;gap:6px}
.total{font-size:15px;font-weight:800}
.qr{display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:10px}
.qr svg{width:40mm;height:40mm;display:block}
.legenda{font-size:10px;text-align:center}
`,
  58: `
@page{size:58mm auto;margin:0}
*{box-sizing:border-box}
body{margin:0 auto;width:48mm;padding:2mm 0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;line-height:1.3;color:#000;overflow-wrap:anywhere}
.centro{text-align:center}
.loja{font-size:12px;font-weight:700;text-transform:uppercase}
.sep{border-top:1px dashed #000;margin:6px 0}
.topo{display:flex;justify-content:space-between;align-items:center;gap:4px}
.numero{font-size:22px;font-weight:800}
.tipo{border:2px solid #000;padding:1px 4px;font-size:10px;font-weight:800}
.cliente{font-weight:700;text-transform:uppercase;margin-top:4px}
.item{margin-bottom:5px}
.nome-item{font-size:12px;font-weight:800}
.adicional{padding-left:12px}
.caixa{border:2px solid #000;padding:4px;margin:6px 0}
.rotulo{font-size:9px;font-weight:800}
.forte{font-weight:700}
.linha{display:flex;justify-content:space-between;gap:4px}
.total{font-size:13px;font-weight:800}
.qr{display:flex;flex-direction:column;align-items:center;gap:3px;margin-top:8px}
.qr svg{width:30mm;height:30mm;display:block}
.legenda{font-size:9px;text-align:center}
`,
};

export function montarHtmlComanda(pedido: PedidoCozinha, config: ConfigImpressaoComanda, qrSvg: string | null = null) {
  const tipoEntrega = obterTipoEntregaPedido(pedido.dados_cliente);
  const endereco = pedido.dados_cliente?.endereco;
  const criadoEm = new Date(pedido.created_at).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const itensHtml = pedido.itens_pedido
    .map((item) => {
      const adicionais = item.adicionais.map((a) => `<div class="adicional">+ ${escaparHtml(a.nome)}</div>`).join('');
      return `<div class="item"><div class="nome-item">${item.quantidade}x ${escaparHtml(item.item_cardapio.nome)}</div>${adicionais}</div>`;
    })
    .join('');

  const observacoes = pedido.dados_cliente?.observacoes
    ? `<div class="caixa"><div class="rotulo">OBSERVAÇÃO</div><div class="forte">${escaparHtml(pedido.dados_cliente.observacoes)}</div></div>`
    : '';

  const enderecoHtml =
    tipoEntrega === 'ENTREGA' && endereco
      ? `<div class="bloco"><div class="rotulo">ENDEREÇO</div>${endereco.bairro ? `<div class="forte">${escaparHtml(endereco.bairro)}</div>` : ''}<div>${escaparHtml(
          [endereco.rua, endereco.numero].filter(Boolean).join(', ')
        )}</div>${endereco.cidade ? `<div>${escaparHtml(endereco.cidade)}</div>` : ''}${endereco.cep ? `<div>CEP ${escaparHtml(endereco.cep)}</div>` : ''}</div>`
      : '';

  const qrHtml = qrSvg ? `<div class="qr">${qrSvg}<div class="legenda">Escaneie para abrir a rota no Maps</div></div>` : '';

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comanda ${escaparHtml(rotuloNumeroPedido(pedido))}</title><style>${ESTILOS_COMANDA[config.largura]}</style></head><body>
<div class="centro"><div class="loja">${escaparHtml(config.nomeLoja || 'Pedido')}</div><div>${escaparHtml(criadoEm)}</div></div>
<div class="sep"></div>
<div class="topo"><span class="numero">${escaparHtml(rotuloNumeroPedido(pedido))}</span><span class="tipo">${tipoEntrega === 'RETIRADA' ? 'RETIRADA' : 'ENTREGA'}</span></div>
<div class="cliente">${escaparHtml(pedido.dados_cliente?.nome ?? '')}</div>
<div>${escaparHtml(formatarTelefoneCozinha(pedido.dados_cliente?.telefone))}</div>
<div class="sep"></div>
${itensHtml}
${observacoes}
${enderecoHtml}
<div class="sep"></div>
<div class="linha"><span>Pagamento</span><span class="forte">${escaparHtml(rotuloFormaPagamento(pedido.forma_pagamento))} · PAGO</span></div>
<div class="linha total"><span>TOTAL</span><span>${escaparHtml(formatarMoedaCozinha(pedido.valor_total))}</span></div>
<div class="sep"></div>
<div class="centro">Pedido pago online. Não cobrar na entrega.</div>
${qrHtml}
</body></html>`;
}

async function gerarQrRotaEntrega(pedido: PedidoCozinha): Promise<string | null> {
  if (obterTipoEntregaPedido(pedido.dados_cliente) !== 'ENTREGA') return null;
  const url = montarUrlLocalizacaoEntrega(pedido.dados_cliente, pedido.cliente_latitude, pedido.cliente_longitude);
  if (!url) return null;
  try {
    return await QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' });
  } catch (erro) {
    console.error('Falha ao gerar QR Code da rota de entrega:', erro);
    return null;
  }
}

export async function imprimirComanda(pedido: PedidoCozinha, config: ConfigImpressaoComanda) {
  const qrSvg = await gerarQrRotaEntrega(pedido);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const documento = iframe.contentDocument;
  const janela = iframe.contentWindow;
  if (!documento || !janela) {
    iframe.remove();
    return;
  }

  documento.open();
  documento.write(montarHtmlComanda(pedido, config, qrSvg));
  documento.close();

  const remover = () => setTimeout(() => iframe.remove(), 500);
  janela.addEventListener('afterprint', remover, { once: true });
  setTimeout(() => {
    janela.focus();
    janela.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) iframe.remove();
    }, 60000);
  }, 150);
}
