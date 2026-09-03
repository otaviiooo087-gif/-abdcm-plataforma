import Link from 'next/link'
import { Aviso, Card, Invariante, Secao, StatusBadge } from '@/components/ui'
import { PROCESS_STATUSES } from '@/domain/registros/state-machine'
import { exigirSessao } from '@/lib/sessao-guard'
import { formatarBRL, resolverPrecoUnitario } from '@/lib/money'
import { banco, doTenant } from '@/store/repo'
import { Contador } from './contador'

export default async function DashboardParceiro() {
  const sessao = await exigirSessao('portal.parceiro')
  const db = await banco(sessao.tenantId)
  const parceiroId = sessao.parceiroId!

  // Isolamento por parceiro: a consulta filtra por tenant e por parceiro antes
  // de qualquer outra coisa. O parceiro A não alcança dados do parceiro B.
  const registros = doTenant(db.registros, sessao.tenantId).filter((r) => r.parceiroId === parceiroId)
  const associados = doTenant(db.associados, sessao.tenantId).filter((a) => a.parceiroId === parceiroId)
  const parceiro = db.parceiros.find((p) => p.id === parceiroId)!
  const lote = doTenant(db.lotes, sessao.tenantId).find((l) => l.status === 'aberto')!

  const preco = resolverPrecoUnitario({
    precoParceiro: parceiro.precoPorNome,
    precoLote: lote.precoPorNome,
    precoPadraoTenant: db.precoPadraoTenant,
  })

  const porStatus = PROCESS_STATUSES.map((s) => ({ status: s, n: registros.filter((r) => r.processStatus === s).length }))
    .filter((x) => x.n > 0)

  const fichasPendentes = associados.filter((a) => a.statusFiliacao !== 'ativo')
  const noLote = registros.filter((r) => r.loteId === lote.id)
  const prontosParaEnviar = noLote.filter((r) => r.processStatus === 'pendente')

  const METAS = [100, 500, 1000, 5000, 10000]
  const proxima = METAS.find((m) => m > parceiro.totalNomesEnviados) ?? null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-borda bg-white p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-azul">Lote vigente</p>
          <h1 className="mt-1 text-xl font-semibold text-marinho">{lote.nome}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Encerra em {lote.closesAt.toLocaleString('pt-BR')} · quem não enviar espera o próximo.
          </p>
        </div>
        <Contador alvoISO={lote.closesAt.toISOString()} />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card titulo="Seus associados" valor={String(associados.length)}
          detalhe={`${associados.filter((a) => a.statusFiliacao === 'ativo').length} com ficha assinada`} />
        <Card titulo="No lote vigente" valor={String(noLote.length)}
          detalhe={`${prontosParaEnviar.length} prontos para enviar`} />
        <Card titulo="Seu preço por nome" valor={formatarBRL(preco.preco)}
          detalhe={`resolvido pela precedência: ${preco.origem}`} />
        <Card titulo="Nomes enviados no total" valor={String(parceiro.totalNomesEnviados)}
          detalhe={proxima ? `faltam ${proxima - parceiro.totalNomesEnviados} para a meta de ${proxima}` : 'todas as metas atingidas'} />
      </div>

      {fichasPendentes.length > 0 && (
        <Aviso tom="alerta">
          <strong>{fichasPendentes.length} associados sem ficha assinada.</strong> Sem a ficha, o
          registro não entra em lote encerrado — a assinatura é o consentimento LGPD do titular.{' '}
          <Link href="/app/associados" className="font-semibold underline">Ver associados</Link>
        </Aviso>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Secao titulo="Seus registros por status">
          <ul className="space-y-2">
            {porStatus.map(({ status, n }) => (
              <li key={status} className="flex items-center justify-between">
                <StatusBadge status={status} />
                <span className="text-sm font-semibold tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
        </Secao>

        <Secao titulo="Ações rápidas">
          <div className="grid gap-2">
            <Link href="/app/envio" className="rounded-lg border border-borda px-3 py-2.5 text-sm font-medium text-marinho transition hover:border-azul hover:bg-azul-claro">
              Enviar lista para o {lote.nome} →
            </Link>
            <Link href="/app/associados" className="rounded-lg border border-borda px-3 py-2.5 text-sm font-medium text-marinho transition hover:border-azul hover:bg-azul-claro">
              Filiar novo associado →
            </Link>
          </div>
          <Invariante codigo="I4">
            O preço acima é o que será congelado no registro no momento do envio. A precedência
            (parceiro → lote → tenant) é resolvida no servidor, uma única vez.
          </Invariante>
        </Secao>
      </div>
    </div>
  )
}
