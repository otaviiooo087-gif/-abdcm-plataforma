import Link from 'next/link'
import { Invariante, StatusBadge } from '@/components/ui'
import { PROCESS_STATUSES } from '@/domain/registros/state-machine'
import { exigirSessao } from '@/lib/sessao-guard'
import { mascararDocumento } from '@/lib/documento'
import { formatarBRL } from '@/lib/money'
import { banco, doTenant } from '@/store/repo'

export default async function Registros({
  searchParams,
}: { searchParams: Promise<{ q?: string; status?: string; lote?: string }> }) {
  const sessao = await exigirSessao('registro.ver')
  const { q, status, lote } = await searchParams
  const db = banco()

  // Filtro por tenant sempre primeiro (I9); busca e filtros vêm depois.
  let registros = doTenant(db.registros, sessao.tenantId)
  if (lote) registros = registros.filter((r) => r.loteId === lote)
  if (status) registros = registros.filter((r) => r.processStatus === status)
  if (q) {
    const termo = q.toLowerCase().trim()
    const digitos = termo.replace(/\D/g, '')
    registros = registros.filter(
      (r) => r.nome.toLowerCase().includes(termo) || (digitos.length >= 4 && r.cpfCnpj.includes(digitos)),
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-marinho">Registros</h1>
        <p className="mt-1 text-sm text-slate-600">
          Busca global. A busca por documento aceita os dígitos, mas a listagem devolve sempre o
          valor mascarado.
        </p>
      </div>

      <form className="flex flex-wrap gap-2 rounded-xl border border-borda bg-white p-3">
        <input name="q" defaultValue={q ?? ''} placeholder="Nome ou CPF/CNPJ"
          className="min-w-56 flex-1 rounded-lg border border-borda px-3 py-2 text-sm" />
        <select name="status" defaultValue={status ?? ''} className="rounded-lg border border-borda px-3 py-2 text-sm">
          <option value="">Todos os status</option>
          {PROCESS_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select name="lote" defaultValue={lote ?? ''} className="rounded-lg border border-borda px-3 py-2 text-sm">
          <option value="">Todos os lotes</option>
          {doTenant(db.lotes, sessao.tenantId).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
        <button className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white">Filtrar</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-borda bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-borda bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Documento</th>
              <th className="px-4 py-2">Lote</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Origem</th>
              <th className="px-4 py-2 text-right">unit_price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {registros.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/admin/registros/${r.id}`} className="font-medium text-marinho hover:text-azul hover:underline">
                    {r.nome}
                  </Link>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-slate-600">{mascararDocumento(r.cpfCnpj)}</td>
                <td className="px-4 py-2 text-xs">{db.lotes.find((l) => l.id === r.loteId)?.nome}</td>
                <td className="px-4 py-2"><StatusBadge status={r.processStatus} /></td>
                <td className="px-4 py-2 text-xs text-slate-500">{r.origem}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatarBRL(r.unitPrice)}</td>
              </tr>
            ))}
            {registros.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Nenhum registro para este filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-borda bg-white p-4">
        <Invariante codigo="I9">
          A consulta começa filtrando por tenant_id e só então aplica busca e filtros — nenhum
          caminho de leitura ignora o tenant, mesmo com a interface sendo single-tenant hoje.
        </Invariante>
      </div>
    </div>
  )
}
