'use client'

import { useMemo, useState } from 'react'
import { IconSearch } from '@/components/icons'
import { formatarBRL } from '@/lib/money'

export type LinhaEnvio = {
  id: string
  nome: string
  ficha: 'assinada' | string
  origem: string
  preco: number
  bonus: boolean
  impedimentos: string[]
}

export function TabelaEnvio({ linhas, precoUnitario, origemPreco }: {
  linhas: LinhaEnvio[]
  precoUnitario: number
  origemPreco: string
}) {
  const elegiveisIds = useMemo(() => linhas.filter((l) => l.impedimentos.length === 0).map((l) => l.id), [linhas])
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set(elegiveisIds))
  const [busca, setBusca] = useState('')

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return linhas
    return linhas.filter((l) => l.nome.toLowerCase().includes(termo))
  }, [linhas, busca])

  function alternar(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      novo.has(id) ? novo.delete(id) : novo.add(id)
      return novo
    })
  }

  const total = linhas
    .filter((l) => selecionados.has(l.id))
    .reduce((soma, l) => soma + l.preco, 0)
  const qtdSelecionada = selecionados.size

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome..."
          className="w-full rounded-lg border border-borda py-2 pl-9 pr-3 text-sm outline-none focus:border-azul focus:ring-2 focus:ring-azul/20 sm:max-w-xs"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-borda bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-borda bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-4 py-2.5"></th>
              <th className="px-2 py-2.5">Nome</th>
              <th className="px-2 py-2.5">Ficha</th>
              <th className="px-2 py-2.5">Origem</th>
              <th className="px-4 py-2.5 text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {filtradas.map((l) => {
              const bloqueado = l.impedimentos.length > 0
              return (
                <tr key={l.id} className={bloqueado ? 'bg-amber-50/60' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selecionados.has(l.id)}
                      disabled={bloqueado}
                      onChange={() => alternar(l.id)}
                      className="h-3.5 w-3.5"
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="font-medium text-marinho">{l.nome}</span>
                    {bloqueado && <p className="text-xs text-ambar">{l.impedimentos.join(' · ')}</p>}
                  </td>
                  <td className="px-2 py-2.5 text-xs">
                    {l.ficha === 'assinada'
                      ? <span className="text-verde">assinada</span>
                      : <span className="text-ambar">{l.ficha}</span>}
                  </td>
                  <td className="px-2 py-2.5 text-xs text-slate-500">{l.origem}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {l.bonus ? <span className="text-verde">bônus</span> : formatarBRL(l.preco)}
                  </td>
                </tr>
              )
            })}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                  Nenhum registro encontrado para esse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borda bg-slate-50 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Valor total da submissão</p>
          <p className="text-2xl font-semibold tabular-nums text-marinho">{formatarBRL(total)}</p>
          <p className="text-xs text-slate-600">
            {qtdSelecionada} nomes selecionados × {formatarBRL(precoUnitario)} (preço do {origemPreco})
          </p>
        </div>
        <button
          disabled
          title="Geração de PIX chega na Fase 1"
          className="rounded-lg bg-azul px-5 py-2.5 text-sm font-semibold text-white transition enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Enviar lista e gerar PIX
        </button>
      </div>
    </div>
  )
}
