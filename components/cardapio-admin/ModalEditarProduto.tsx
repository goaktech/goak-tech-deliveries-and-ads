'use client'

import React, { useState, useTransition } from 'react'
import { atualizarProdutoAdmin } from '@/actions/cardapio'
import { createPortal } from 'react-dom'
import { Insumo } from '@/types/database'
import { ItemCardapioComCMV } from '@/actions/admin'
import { AbaDadosBasicos, AbaFichaTecnica, AbaAdicionaisOpcionais } from './AbasFormularioProduto'
import { useRouter } from 'next/navigation'

const TAMANHO_MAXIMO_IMAGEM_MB = 5

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
  const [isPending, startTransition] = useTransition()
  const [abaAtiva, setAbaAtiva] = useState<'DADOS' | 'FICHA' | 'ADICIONAIS'>('DADOS')

  const [nome, setNome] = useState(produto.nome)
  const [descricao, setDescricao] = useState(produto.descricao || '')
  const [preco, setPreco] = useState(String(produto.preco_venda))
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
      alert('Formato inválido. Use PNG, JPG ou WEBP.')
      event.target.value = ''
      return
    }

    const tamanhoMaximoBytes = TAMANHO_MAXIMO_IMAGEM_MB * 1024 * 1024
    if (arquivo.size > tamanhoMaximoBytes) {
      alert(`A imagem deve ter no máximo ${TAMANHO_MAXIMO_IMAGEM_MB}MB.`)
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
      alert('Por favor, preencha os campos obrigatórios (Nome e Preço).')
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
        imagemDataUrl: fotoDataUrl || undefined
      })

      if (resultado.success) {
        onFechar()
        router.refresh()
      } else {
        alert(`Erro ao salvar edição: ${resultado.error}`)
      }
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/30 p-4 backdrop-blur-sm transition-all duration-200">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl transform transition-all animate-in fade-in zoom-in-95 duration-150">

        <div className="flex items-center justify-between border-b border-zinc-100 p-5">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-[#1A1A1A]">Editar {produto.nome}</h2>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-500 transition hover:bg-zinc-200"
          >
            ✕
          </button>
        </div>

        <div className="shrink-0 overflow-x-auto border-b border-zinc-100 bg-[#F8F8F8] p-1 text-[11px] font-semibold">
          <div className="flex min-w-[500px]">
            <button
              type="button"
              onClick={() => setAbaAtiva('DADOS')}
              className={`flex-1 text-center py-2.5 rounded-[10px] transition-all ${abaAtiva === 'DADOS' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              Dados do Cardápio
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva('FICHA')}
              className={`flex-1 text-center py-2.5 rounded-[10px] transition-all ${abaAtiva === 'FICHA' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              Ficha Técnica (CMV)
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva('ADICIONAIS')}
              className={`flex-1 text-center py-2.5 rounded-[10px] transition-all ${abaAtiva === 'ADICIONAIS' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              Adicionais
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-5">
          <div className="min-h-[220px] flex flex-col">
            {abaAtiva === 'DADOS' && (
              <AbaDadosBasicos
                nome={nome} setNome={setNome}
                descricao={descricao} setDescricao={setDescricao}
                preco={preco} setPreco={setPreco}
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

          <div className="flex items-center gap-3 border-t border-zinc-100 pt-2">
            <button
              type="button"
              onClick={onFechar}
              className="flex-1 rounded-xl bg-zinc-100 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-600 hover:bg-zinc-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-xl bg-[#E16349] py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#c8523a] disabled:opacity-50 transition-all"
            >
              {isPending ? 'Salvando alterações...' : 'Salvar alterações'}
            </button>
          </div>
        </form>

      </div>
    </div>,
    document.body
  )
}
