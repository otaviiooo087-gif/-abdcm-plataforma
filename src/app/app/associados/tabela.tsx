'use client'

import { useMemo, useState } from 'react'
import { IconEdit, IconSearch, IconTrash } from '@/components/icons'
import type { StatusFiliacao } from '@/store/schema'

export type LinhaAssociado = {
  id: string
  nome: string
  documento: string
  tipo: 'cpf' | 'cnpj'
  statusFiliacao: StatusFiliacao
  dataReferencia: string
}

const ROTULO: Record<StatusFiliacao, { texto: string; classe: string }> = {
  pre_cadastro: { texto: 'Pré-cadastro', classe: 'bg-slate-100 text-slate-600 ring-slate-200' },
  ficha_enviada: { texto: 'Ficha enviada', classe: 'bg-amber-50 text-amber-800 ring-amber-200' },
  ficha_assinada: { texto: 'Ficha assinada', classe: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  ativo: { texto: 'Ativo', classe: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  inativo: { texto: 'Inativo', classe: 'bg-neutral-100 text-neutral-500 ring-neutral-200' },
}

export function TabelaAssociados({ linhas }: { linhas: LinhaAssociado[] }) {
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState<'todos' | StatusFiliacao>('todos')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return linhas.filter((l) => {
      if (status !== 'todos' && l.statusFiliacao !== status) return false
      if (!termo) return true
      return l.nome.toLowerCase().includes(termo) || l.documento.toLowerCase().includes(termo)
    })
  }, [linhas, busca, status])

  const todasVisiveisSelecionadas = filtradas.length > 0 && filtradas.every((l) => selecionados.has(l.id))

  function alternarTodas() {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (todasVisiveisSelecionadas) filtradas.forEach((l) => novo.delete(l.id))
      else filtradas.forEach((l) => novo.add(l.id))
      return novo
    })
  }

  function alternarUma(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      novo.has(id) ? novo.delete(id) : novo.add(id)
      return novo
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou CPF/CNPJ..."
            className="w-full rounded-lg border border-borda py-2 pl-9 pr-3 text-sm outline-none focus:border-azul focus:ring-2 focus:ring-azul/20"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="rounded-lg border border-borda px-3 py-2 text-sm text-slate-700 outline-none focus:border-azul"
        >
          <option value="todos">Todos os status</option>
          {(Object.keys(ROTULO) as StatusFiliacao[]).map((s) => (
            <option key={s} value={s}>{ROTULO[s].texto}</option>
          ))}
        </select>
      </div>

      {selecionados.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-azul/25 bg-azul-claro px-3 py-2 text-xs text-marinho">
          <span>{selecionados.size} selecionado{selecionados.size > 1 ? 's' : ''}</span>
          <button onClick={() => setSelecionados(new Set())} className="font-semibold text-azul hover:underline">
            limpar seleção
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-borda bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-borda bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-4 py-2.5">
                <input type="checkbox" checked={todasVisiveisSelecionadas} onChange={alternarTodas} className="h-3.5 w-3.5" />
              </th>
              <th className="px-2 py-2.5">Nome</th>
              <th className="px-2 py-2.5">CPF/CNPJ</th>
              <th className="px-2 py-2.5">Tipo</th>
              <th className="px-2 py-2.5">Status</th>
              <th className="px-2 py-2.5">Data</th>
              <th className="px-4 py-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {filtradas.map((l) => {
              const r = ROTULO[l.statusFiliacao]
              return (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <input type="checkbox" checked={selecionados.has(l.id)} onChange={() => alternarUma(l.id)} className="h-3.5 w-3.5" />
                  </td>
                  <td className="px-2 py-2.5 font-medium text-marinho">{l.nome}</td>
                  <td className="px-2 py-2.5 font-mono text-xs text-slate-600">{l.documento}</td>
                  <td className="px-2 py-2.5">
                    <span className="rounded border border-borda px-1.5 py-0.5 text-[11px] font-medium uppercase text-slate-500">
                      {l.tipo}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${r.classe}`}>
                      {r.texto}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-xs text-slate-500">{l.dataReferencia}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        disabled
                        title="Edição de associado chega na Fase 1"
                        className="rounded p-1.5 text-slate-400 transition enabled:hover:bg-azul-claro enabled:hover:text-azul disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <IconEdit />
                      </button>
                      <button
                        disabled
                        title="Exclusão de associado chega na Fase 1"
                        className="rounded p-1.5 text-slate-400 transition enabled:hover:bg-red-50 enabled:hover:text-vermelho disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                  Nenhum associado encontrado para esse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
