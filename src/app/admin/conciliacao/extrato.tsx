'use client'

import { useMemo, useState } from 'react'
import { IconDownload, IconSearch } from '@/components/icons'
import { formatarBRL } from '@/lib/money'
import type { StatusPagamento } from '@/store/schema'

export type LinhaExtrato = {
  id: string
  parceiro: string
  lote: string
  nomesCount: number
  valorTotal: number
  status: StatusPagamento
  submetidoEmIso: string
  motivoObservacao: string | null
}

const STATUS_LABEL: Record<StatusPagamento, string> = {
  pago: 'Conciliado',
  pendente: 'Aguardando',
  expirado: 'Expirado',
  reprovado: 'Reprovado',
  cancelado: 'Cancelado',
}

const STATUS_TOM: Record<StatusPagamento, string> = {
  pago: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  pendente: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  expirado: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  reprovado: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  cancelado: 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-300',
}

export function ExtratoFinanceiro({ transacoes }: { transacoes: LinhaExtrato[] }) {
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState<StatusPagamento | 'todos'>('todos')

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return transacoes.filter((t) => {
      if (status !== 'todos' && t.status !== status) return false
      if (!termo) return true
      return t.id.toLowerCase().includes(termo) || t.parceiro.toLowerCase().includes(termo) || t.lote.toLowerCase().includes(termo)
    })
  }, [transacoes, busca, status])

  function exportarCsv() {
    const cabecalho = ['ID Submissão', 'Parceiro', 'Lote', 'Associados', 'Valor (R$)', 'Status', 'Submetido em', 'Observação']
    const linhas = filtradas.map((t) => [
      t.id, t.parceiro, t.lote, String(t.nomesCount), formatarBRL(t.valorTotal),
      STATUS_LABEL[t.status], new Date(t.submetidoEmIso).toLocaleString('pt-BR'), t.motivoObservacao ?? '',
    ])
    const csv = '﻿' + [cabecalho, ...linhas].map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `extrato_financeiro_abdcm_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borda bg-white p-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por submissão, parceiro ou lote…"
              className="w-full rounded-lg border border-borda bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-azul focus:ring-2 focus:ring-azul/20" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusPagamento | 'todos')}
            className="rounded-lg border border-borda bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700">
            <option value="todos">Todos os status</option>
            <option value="pago">Conciliados</option>
            <option value="pendente">Aguardando</option>
            <option value="reprovado">Reprovados</option>
            <option value="expirado">Expirados</option>
            <option value="cancelado">Cancelados</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {filtradas.length} lançamento{filtradas.length === 1 ? '' : 's'}
          </span>
          <button type="button" onClick={exportarCsv}
            className="flex items-center gap-1.5 rounded-lg border border-azul/40 px-3 py-1.5 text-xs font-semibold text-azul transition hover:bg-azul-claro">
            <IconDownload className="h-3.5 w-3.5" /> exportar CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-borda bg-white">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-borda bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Submissão</th>
              <th className="px-4 py-2.5">Parceiro</th>
              <th className="px-4 py-2.5">Lote</th>
              <th className="px-4 py-2.5">Associados</th>
              <th className="px-4 py-2.5">Valor</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {filtradas.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Nenhuma transação encontrada.</td></tr>
            ) : filtradas.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-mono font-semibold text-azul">#{t.id.slice(0, 8)}</td>
                <td className="px-4 py-2.5 font-medium text-marinho">{t.parceiro}</td>
                <td className="px-4 py-2.5 text-slate-600">{t.lote}</td>
                <td className="px-4 py-2.5 text-slate-700">{t.nomesCount}</td>
                <td className="px-4 py-2.5 font-semibold tabular-nums text-slate-900">{formatarBRL(t.valorTotal)}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_TOM[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                  {new Date(t.submetidoEmIso).toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
