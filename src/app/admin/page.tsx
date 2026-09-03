import Link from 'next/link'
import { Aviso, Card, Invariante, Secao, StatusBadge } from '@/components/ui'
import { exigirSessao } from '@/lib/sessao-guard'
import { pode } from '@/lib/authz'
import { mascararDocumento } from '@/lib/documento'
import { formatarBRL } from '@/lib/money'
import { banco, doTenant } from '@/store/repo'

function horasDesde(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / 3_600_000)
}

export default async function PainelDoDia() {
  const sessao = await exigirSessao('admin.acessar')
  const db = await banco(sessao.tenantId)
  const t = sessao.tenantId

  const registros = doTenant(db.registros, t)
  const submissoes = doTenant(db.submissoes, t)
  const contestacoes = doTenant(db.contestacoes, t)
  const lote = doTenant(db.lotes, t).find((l) => l.status === 'aberto')!

  const doLote = registros.filter((r) => r.loteId === lote.id)
  const prontos = doLote.filter((r) => r.processStatus === 'aguardando_protocolo')
  const fila = submissoes.filter((s) => s.paymentStatus === 'pendente' && s.motivoExcecao)
  const maisAntigo = fila.reduce<number>((max, s) => Math.max(max, horasDesde(s.submetidoEm)), 0)
  const foraSla = contestacoes.filter((c) => c.status === 'aberta' && c.slaVenceEm.getTime() < Date.now())
  const semPagamento48h = submissoes.filter(
    (s) => s.paymentStatus === 'pendente' && horasDesde(s.submetidoEm) >= 48,
  )

  const semFicha = doLote.filter((r) => {
    const a = db.associados.find((x) => x.id === r.associadoId)
    return !a || a.statusFiliacao !== 'ativo'
  })

  const porCpf = new Map<string, number>()
  for (const r of doLote) porCpf.set(r.cpfCnpj, (porCpf.get(r.cpfCnpj) ?? 0) + 1)
  const duplicados = [...porCpf.values()].filter((n) => n > 1).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-marinho">Painel do dia</h1>
        <p className="mt-1 text-sm text-slate-600">
          Não é dashboard de métricas — é a lista do que precisa de atenção hoje. Todo número leva
          às linhas que o compõem.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card titulo="Pagos e prontos" valor={String(prontos.length)}
          detalhe={`${lote.nome} · o número que importa`} tom="bom" href="/admin/lote" />
        <Card titulo="Fila de conciliação" valor={String(fila.length)}
          detalhe={fila.length ? `mais antigo há ${maisAntigo}h` : 'nada na fila'}
          tom={maisAntigo >= 48 ? 'critico' : fila.length ? 'alerta' : 'neutro'}
          href={pode(sessao.role, 'conciliacao.ver') ? '/admin/conciliacao' : undefined} />
        <Card titulo="Contestações abertas" valor={String(contestacoes.filter((c) => c.status === 'aberta').length)}
          detalhe={`${foraSla.length} fora do SLA de 48h`} tom={foraSla.length ? 'critico' : 'neutro'}
          href={pode(sessao.role, 'contestacao.ver') ? '/admin/contestacoes' : undefined} />
        <Card titulo="Registros no lote vigente" valor={String(doLote.length)}
          detalhe={`encerra em ${Math.max(0, Math.ceil((lote.closesAt.getTime() - Date.now()) / 86_400_000))} dias`} />
      </div>

      <Secao titulo="Sinais anômalos">
        <ul className="space-y-2 text-sm">
          <li className="flex items-center justify-between rounded-lg border border-borda px-3 py-2">
            <span>Submissões sem pagamento há 48h ou mais</span>
            <strong className={semPagamento48h.length ? 'text-vermelho' : 'text-slate-400'}>
              {semPagamento48h.length}
            </strong>
          </li>
          <li className="flex items-center justify-between rounded-lg border border-borda px-3 py-2">
            <span>Registros no lote sem ficha associativa assinada</span>
            <strong className={semFicha.length ? 'text-ambar' : 'text-slate-400'}>{semFicha.length}</strong>
          </li>
          <li className="flex items-center justify-between rounded-lg border border-borda px-3 py-2">
            <span>CPFs duplicados dentro do lote vigente</span>
            <strong className={duplicados ? 'text-ambar' : 'text-slate-400'}>{duplicados}</strong>
          </li>
        </ul>
        <Invariante codigo="I5">
          Registro sem ficha assinada não entra em lote encerrado. O gate é validado no
          encerramento, no servidor — a contagem acima é o aviso antecipado.
        </Invariante>
      </Secao>

      <Secao titulo={`Composição do ${lote.nome}`}
        acao={<Link href="/admin/lote" className="text-xs font-semibold text-azul">Abrir console do lote →</Link>}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="pb-2 pr-3">Nome</th>
                <th className="pb-2 pr-3">Documento</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Ficha</th>
                <th className="pb-2 pr-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {doLote.slice(0, 8).map((r) => {
                const a = db.associados.find((x) => x.id === r.associadoId)
                return (
                  <tr key={r.id}>
                    <td className="py-2 pr-3">
                      <Link href={`/admin/registros/${r.id}`} className="font-medium text-marinho hover:text-azul hover:underline">
                        {r.nome}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-600">
                      {mascararDocumento(r.cpfCnpj)}
                    </td>
                    <td className="py-2 pr-3"><StatusBadge status={r.processStatus} /></td>
                    <td className="py-2 pr-3 text-xs">
                      {a?.statusFiliacao === 'ativo'
                        ? <span className="text-verde">✅ assinada</span>
                        : <span className="text-ambar">⚠️ {a?.statusFiliacao ?? '—'}</span>}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {r.isBonus ? <span className="text-verde">bônus</span> : formatarBRL(r.unitPrice)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Invariante codigo="I6">
          O documento sai mascarado do servidor. O valor completo só é resolvido na revelação
          explícita, dentro da ficha do registro, e a revelação vira linha de auditoria.
        </Invariante>
      </Secao>

      {!pode(sessao.role, 'conciliacao.ver') && (
        <Aviso tom="info">
          Este papel não enxerga a fila de conciliação. O item nem aparece no menu, e a rota recusa
          o acesso direto — separação de funções aplicada no servidor.
        </Aviso>
      )}
    </div>
  )
}
