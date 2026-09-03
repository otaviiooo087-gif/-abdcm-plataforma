import Link from 'next/link'
import { Invariante, Secao } from '@/components/ui'
import { exigirSessao } from '@/lib/sessao-guard'
import { banco, doTenant } from '@/store/repo'

export default async function Contestacoes() {
  const sessao = await exigirSessao('contestacao.ver')
  const db = banco()
  const lista = doTenant(db.contestacoes, sessao.tenantId)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-marinho">Contestações</h1>
        <p className="mt-1 text-sm text-slate-600">
          Fila com SLA cronometrado de 48h. A abertura é bloqueada até 72h após o lote estar
          concluído — validação de servidor, não aviso de tela.
        </p>
      </div>

      <Secao titulo={`${lista.filter((c) => c.status === 'aberta').length} abertas`}>
        <ul className="space-y-2">
          {lista.map((c) => {
            const restante = c.slaVenceEm.getTime() - Date.now()
            const horas = Math.round(restante / 3_600_000)
            const tom = restante < 0 ? 'border-red-300 bg-red-50' : horas <= 12 ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'
            const registro = db.registros.find((r) => r.id === c.registroId)
            return (
              <li key={c.id} className={`rounded-lg border p-3 ${tom}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-marinho">
                      {registro ? (
                        <Link href={`/admin/registros/${registro.id}`} className="hover:underline">{registro.nome}</Link>
                      ) : c.registroId}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {c.descricao} · parceiro {db.parceiros.find((p) => p.id === c.parceiroId)?.nomeExibicao}
                    </p>
                  </div>
                  <span className="text-xs font-semibold tabular-nums">
                    {restante < 0 ? `${Math.abs(horas)}h fora do SLA` : `${horas}h restantes`}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[11px] text-slate-500">reason_code: {c.reasonCode}</p>
              </li>
            )
          })}
        </ul>
        <Invariante codigo="I1">
          A carência de 72h e o SLA de 48h são calculados e aplicados no servidor. A tela mostra o
          cronômetro; ela não é quem decide se a contestação pode ser aberta.
        </Invariante>
      </Secao>
    </div>
  )
}
