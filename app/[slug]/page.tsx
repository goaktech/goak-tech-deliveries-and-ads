import { notFound } from 'next/navigation';
import { obterCardapioPorSlug } from '@/actions/cardapio';
import { renderizarLojaPublica } from '@/components/ecommerce/temas/SeletorLojaPublica';
import { LojaFechadaAviso } from '@/components/ecommerce/LojaFechadaAviso';
import { estaLojaAberta, type HorarioFuncionamentoDia } from '@/utils/horario-funcionamento';

interface PaginaCardapioProps {
  params: Promise<{
    slug: string;
  }>;
}

interface ComplementoProdutoPagina {
  id: string;
  item_cardapio_id: string;
  nome: string;
  preco_adicional: number | string;
  disponivel: boolean;
  created_at: string;
  grupo: string | null;
}

interface ProdutoPagina {
  id: string;
  restaurante_id: string;
  nome: string;
  descricao: string | null;
  preco_venda: number | string;
  imagem_url: string | null;
  disponivel: boolean;
  created_at: string;
  complementos_produto: ComplementoProdutoPagina[] | null;
}

export const revalidate = 0;

export default async function PaginaCardapioPublico({ params }: PaginaCardapioProps) {
  const { slug } = await params;

  const { restaurante, produtos } = await obterCardapioPorSlug(slug);

  if (!restaurante) {
    notFound();
  }

  const horariosFuncionamento = (restaurante as { horarios_funcionamento?: HorarioFuncionamentoDia[] | null })
    .horarios_funcionamento;

  if (!estaLojaAberta(horariosFuncionamento)) {
    return (
      <main className="min-h-screen bg-[#FDFDFD]">
        <LojaFechadaAviso nomeRestaurante={restaurante.nome} horarios={horariosFuncionamento ?? []} />
      </main>
    );
  }

  const produtosNormalizados = (produtos as ProdutoPagina[]).map((p) => ({
    id: p.id,
    restaurante_id: p.restaurante_id,
    nome: p.nome,
    descricao: p.descricao ?? '',
    preco_venda: Number(p.preco_venda),
    imagem_url: p.imagem_url ?? '',
    disponivel: p.disponivel,
    created_at: p.created_at,
    complementos_produto: (p.complementos_produto || []).map((c) => ({
      id: c.id,
      item_cardapio_id: c.item_cardapio_id,
      nome: c.nome,
      preco_adicional: Number(c.preco_adicional),
      disponivel: c.disponivel,
      created_at: c.created_at,
      grupo: c.grupo ?? null,
    })).filter((c) => c.disponivel),
  }));

  return (
    <main className="min-h-screen bg-[#FDFDFD]">
      {renderizarLojaPublica({
        slug,
        tipo: restaurante.tipo,
        restaurante: {
          id: restaurante.id,
          nome: restaurante.nome,
          endereco: restaurante.endereco ?? null,
        },
        produtos: produtosNormalizados,
      })}
    </main>
  );
}
