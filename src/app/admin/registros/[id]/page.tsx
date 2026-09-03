import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Invariante, Secao, StatusBadge } from '@/components/ui'
import { STATUS_LABELS, transicoesDisponiveis } from '@/domain/registros/state-machine'
import { exigirSessao } from '@/lib/sessao-guard'
import { pode } from '@/lib/authz'
import { mascararDocumento } from '@/lib/documento'
import { formatarBRL } from '@/lib/money'
import { banco, doTenant, eventosDoRegistro } from '@/store/repo'
import { BotaoRevelar } from './revelar'

const dt = (d: Date) =>
  d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default async function FichaRegistro({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessao = await exigirSessao('registro.ver')
  const db = await banco(sessao.tenantId)

  const registro = doTenant(db.registros, sessao.tenantId).find((r) => r.id === id)
  if (!registro) notFound()

  const associado = db.associados.find((a) => a.id === registro.associadoId)
  const parceiro = db.parceiros.find((p) => p.id === registro.parceiroId)
  const lote = db.lotes.find((l) => l.id === registro.loteId)
  const eventos = await eventosDoRegistro(registro.id)

  return (
    <div className="space-y-5">
      <Link href="/admin/registros" className="text-xs font-semibold text-azul">← Registros</Link>

      <header className="rounded-xl border border-borda bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-marinho">{registro.nome}</h1>
            <div className="mt-2">
              <BotaoRevelar
                registroId={registro.id}
                mascarado={mascararDocumento(registro.cpfCnpj)}
              />
            </div>
          </div>
          <div className="text-right">
            <StatusBadge status={registro.processStatus} />
            <p className="mt-1 max-w-xs text-xs text-slate-500">{STATUS_LABELS[registro.processStatus]}</p>
          </div>
        </div>

        <dl className="mt-5 grid gap-3 text-sm md:grid-cols-4">
          <div><dt className="text-xs text-slate-500">Parceiro</dt><dd className="font-medium">{parceiro?.nomeExibicao}</dd></div>
          <div><dt className="text-xs text-slate-500">Lote</dt><dd className="font-medium">{lote?.nome}</dd></div>
          <div>
            <dt className="text-xs text-slate-500">unit_price (congelado)</dt>
            <dd className="font-medium tabular-nums">{registro.isBonus ? 'bônus (R$ 0,00)' : formatarBRL(registro.unitPrice)}</dd>
          </div>
          <div><dt className="text-xs text-slate-500">Protocolo</dt><dd className="font-mono text-xs">{registro.protocolCode ?? '—'}</dd></div>
          <div>
            <dt className="text-xs text-slate-500">Ficha associativa</dt>
            <dd className="font-medium">
              {associado?.statusFiliacao === 'ativo'
                ? <span className="text-verde">assinada</span>
                : <span className="text-ambar">{associado?.statusFiliacao ?? '—'}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Consentimento LGPD</dt>
            <dd className="text-xs">
              {associado?.consentimentoEm
                ? <>{dt(associado.consentimentoEm)} · IP {associado.consentimentoIp}</>
                : '—'}
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-xs text-slate-500">Hash do documento assinado</dt>
            <dd className="truncate font-mono text-xs">{associado?.consentimentoHash ?? '—'}</dd>
          </div>
        </dl>
        <Invariante codigo="I4">
          O preço unitário foi resolvido uma única vez, no envio, e é imutável. Correção de valor
          acontece por lançamento de ajuste no ledger, nunca reescrevendo este campo.
        </Invariante>
      </header>

      <Secao titulo={`Timeline do processo — ${eventos.length} eventos imutáveis`}>
        <ol className="relative space-y-4 border-l border-borda pl-5">
          {eventos.map((e, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-azul ring-4 ring-azul-claro" />
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={e.deStatus} />
                <span className="text-slate-400">→</span>
                <StatusBadge status={e.paraStatus} />
                <span className="text-xs text-slate-500">{dt(e.ocorridoEm)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                ator: <strong>{e.atorTipo}</strong>
                {e.atorUserId && <> · {db.users.find((u) => u.id === e.atorUserId)?.nome ?? e.atorUserId}</>}
                {e.reasonCode && <> · motivo: <code className="rounded bg-slate-100 px-1">{e.reasonCode}</code></>}
              </p>
              {e.motivo && <p className="mt-0.5 text-xs italic text-slate-500">“{e.motivo}”</p>}
            </li>
          ))}
          {eventos.length === 0 && (
            <li className="text-sm text-slate-500">Nenhuma transição ainda — registro recém-cadastrado.</li>
          )}
        </ol>
        <Invariante codigo="I2">
          Esta timeline não é um log de conveniência: é a consequência de não existir, no código,
          caminho capaz de alterar status sem gravar o evento correspondente.
        </Invariante>
      </Secao>

      <Secao titulo="Transições disponíveis a partir do status atual">
        <div className="flex flex-wrap gap-2">
          {transicoesDisponiveis(registro.processStatus).map((t) => (
            <span key={t} className="rounded-lg border border-borda bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-700">
              {t}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Qualquer outra transição falha com erro de domínio, no servidor. A lista vem da máquina de
          estados, não de uma condição escrita na tela.
          {!pode(sessao.role, 'registro.status.alterar') &&
            ' Seu papel pode ver, mas não executar transição.'}
        </p>
      </Secao>
    </div>
  )
}
