'use client'

import React, { useState, useTransition } from 'react'
import { atualizarProdutoAdmin } from '@/actions/cardapio'
import { createPortal } from 'react-dom'
import { Insumo } from '@/types/database'
import { ItemCardapioComCMV } from '@/actions/admin'
import { AbaDadosBasicos, AbaFichaTecnica, AbaAdicionaisOpcionais } from './AbasFormularioProduto'
import { useRouter } from 'next/navigation'
import { useAvisosPainel } from '@/components/shared/AvisosPainel'

const TAMANHO_MAXIMO_IMAGEM_MB = 7

interface ModalEditarProdutoProps {
  produto: ItemCardapioComCMV | null
  onFechar: () => void
  insumosDisponiveis: Insumo[]
}

export default function ModalEditarProduto({ produto, onFechar, insumosDisponiveis }: ModalEditarProdutoProps) {
  if (!produto || typeof document === 'undefined') return null

  return (
    <FormularioEdicaoProduto
      key={produto.id}
      produto={produto}
      onFechar={onFechar}
      insumosDisponiveis={insumosDisponiveis}
    />
  )
}

interface FormularioEdicaoProdutoProps {
  produto: ItemCardapioComCMV
  onFechar: () => void
  insumosDisponiveis: Insumo[]
}

function FormularioEdicaoProduto({ produto, onFechar, insumosDisponiveis }: FormularioEdicaoProdutoProps) {
  const router = useRouter()
  const { avisar } = useAvisosPainel()
  const [isPending, startTransition] = useTransition()
  const [abaAtiva, setAbaAtiva] = useState<'DADOS' | 'FICHA' | 'ADICIONAIS'>('DADOS')

  const [nome, setNome] = useState(produto.nome)
  const [descricao, setDescricao] = useState(produto.descricao || '')
  const [preco, setPreco] = useState(String(produto.preco_venda))
  const [categoria, setCategoria] = useState(produto.categoria || '')
  const [diaSemana, setDiaSemana] = useState(
    produto.dia_semana === null || produto.dia_semana === undefined ? '' : String(produto.dia_semana)
  )
  const [quantidadesFicha, setQuantidadesFicha] = useState<Record<string, string>>(() =>
    Object.fromEntries(produto.fichaTecnica.map((f) => [f.insumo_id, String(f.quantidade_necessaria)]))
  )
  const [adicionais, setAdicionais] = useState<Array<{ nome: string; preco: number }>>(() =>
    produto.complementos.map((c) => ({ nome: c.nome, preco: c.preco_adicional }))
  )
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState(produto.imagem_url || '')
  const [fotoDataUrl, setFotoDataUrl] = useState('')
  const [nomeArquivoFoto, setNomeArquivoFoto] = useState('')

  const [novoAdicionalNome, setNovoAdicionalNome] = useState('')
  const [novoAdicionalPreco, setNovoAdicionalPreco] = useState('')

  const handleFichaChange = (id: string, valor: string) => {
    setQuantidadesFicha(prev => ({ ...prev, [id]: valor }))
  }

  const handleAdicionarOpcional = () => {
    if (!novoAdicionalNome || !novoAdicionalPreco) return
    setAdicionais(prev => [...prev, { nome: novoAdicionalNome, preco: parseFloat(novoAdicionalPreco) }])
    setNovoAdicionalNome('')
    setNovoAdicionalPreco('')
  }

  const handleRemoverOpcional = (indexParaRemover: number) => {
    setAdicionais(prev => prev.filter((_, idx) => idx !== indexParaRemover))
  }

  const handleSelecionarFoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.target.files?.[0]
    if (!arquivo) return

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(arquivo.type)) {
      avisar('Formato inválido. Use PNG, JPG ou WEBP.', 'erro')
      event.target.value = ''
      return
    }

    const tamanhoMaximoBytes = TAMANHO_MAXIMO_IMAGEM_MB * 1024 * 1024
    if (arquivo.size > tamanhoMaximoBytes) {
      avisar(`A imagem deve ter no máximo ${TAMANHO_MAXIMO_IMAGEM_MB}MB.`, 'erro')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const resultado = String(reader.result ?? '')
      setFotoPreviewUrl(resultado)
      setFotoDataUrl(resultado)
      setNomeArquivoFoto(arquivo.name)
    }
    reader.readAsDataURL(arquivo)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome || !preco) {
      avisar('Por favor, preencha os campos obrigatórios (Nome e Preço).', 'erro')
      return
    }

    startTransition(async () => {
      const resultado = await atualizarProdutoAdmin(produto.id, {
        nome,
        descricao,
        preco_venda: parseFloat(preco),
        disponivel: produto.disponivel,
        fichaTecnica: quantidadesFicha,
        adicionais,
        imagemDataUrl: fotoDataUrl || undefined,
        categoria: categoria || null,
        diaSemana: diaSemana === '' ? null : Number(diaSemana)
      })

      if (resultado.success) {
        onFechar()
        router.refresh()
      } else {
        avisar(`Não foi possível salvar as alterações: ${resultado.error}`, 'erro')
      }
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/30 p-3 backdrop-blur-sm transition-all duration-200 sm:p-4">
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl transform transition-all animate-in fade-in zoom-in-95 duration-150">

        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 p-5">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-[#1A1A1A]">Editar {produto.nome}</h2>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-200 sm:h-8 sm:w-8"
          >
            ✕
          </button>
        </div>

        <div className="shrink-0 border-b border-zinc-100 bg-[#F8F8F8] p-1 text-xs font-semibold">
          <div className="flex gap-1" role="tablist">
            <button
              type="button"
              onClick={() => setAbaAtiva('DADOS')}
              className={`min-h-11 flex-1 text-center py-2.5 rounded-[10px] transition-all ${abaAtiva === 'DADOS' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              Dados
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva('FICHA')}
              className={`min-h-11 flex-1 text-center py-2.5 rounded-[10px] transition-all ${abaAtiva === 'FICHA' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              Ficha técnica
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva('ADICIONAIS')}
              className={`min-h-11 flex-1 text-center py-2.5 rounded-[10px] transition-all ${abaAtiva === 'ADICIONAIS' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              Adicionais
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-[220px] flex-1 flex-col overflow-y-auto p-5">
            {abaAtiva === 'DADOS' && (
              <AbaDadosBasicos
                nome={nome} setNome={setNome}
                descricao={descricao} setDescricao={setDescricao}
                preco={preco} setPreco={setPreco}
                categoria={categoria} setCategoria={setCategoria}
                diaSemana={diaSemana} setDiaSemana={setDiaSemana}
                fotoPreviewUrl={fotoPreviewUrl}
                nomeArquivoFoto={nomeArquivoFoto}
                onSelecionarFoto={handleSelecionarFoto}
              />
            )}

            {abaAtiva === 'FICHA' && (
              <AbaFichaTecnica
                insumosDisponiveis={insumosDisponiveis}
                quantidadesFicha={quantidadesFicha}
                onFichaChange={handleFichaChange}
              />
            )}

            {abaAtiva === 'ADICIONAIS' && (
              <AbaAdicionaisOpcionais
                adicionais={adicionais}
                novoNome={novoAdicionalNome} setNovoNome={setNovoAdicionalNome}
                novoPreco={novoAdicionalPreco} setNovoPreco={setNovoAdicionalPreco}
                onAdicionar={handleAdicionarOpcional}
                onRemover={handleRemoverOpcional}
              />
            )}
          </div>

          <div className="flex shrink-0 items-center gap-3 border-t border-zinc-100 bg-white p-4">
            <button
              type="button"
              onClick={onFechar}
              className="min-h-11 flex-1 rounded-xl bg-zinc-100 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-600 hover:bg-zinc-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="min-h-11 flex-1 rounded-xl bg-[#E16349] py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#c8523a] disabled:opacity-50 transition-all"
            >
              {isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>

      </div>
    </div>,
    document.body
  )
}
