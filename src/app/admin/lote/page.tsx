import { Aviso, Card, Invariante, Secao, StatusBadge } from '@/components/ui'
import { exigirSessao } from '@/lib/sessao-guard'
import { pode } from '@/lib/authz'
import { formatarBRL } from '@/lib/money'
import { banco, doTenant } from '@/store/repo'
import { ChecklistEncerramento, type Gate } from './checklist'

const CICLO = ['rascunho', 'aberto', 'encerrado', 'em_protocolo', 'protocolado', 'concluido'] as const

export default async function ConsoleDoLote() {
  const sessao = await exigirSessao('lote.ver')
  const db = await banco(sessao.tenantId)
  const t = sessao.tenantId

  const lote = doTenant(db.lotes, t).find((l) => l.status === 'aberto')!
  const registros = doTenant(db.registros, t).filter((r) => r.loteId === lote.id)
  const submissoes = doTenant(db.submissoes, t).filter((s) => s.loteId === lote.id)

  const prontos = registros.filter((r) => ['pago', 'aguardando_protocolo'].includes(r.processStatus))
  const semPagamento = registros.filter((r) => r.processStatus === 'enviado')
  const semFicha = registros.filter((r) => {
    const a = db.associados.find((x) => x.id === r.associadoId)
    return !a || a.statusFiliacao !== 'ativo'
  })
  const naFila = submissoes.filter((s) => s.paymentStatus === 'pendente' && s.motivoExcecao)

  const contagem = new Map<string, number>()
  for (const r of registros) contagem.set(r.cpfCnpj, (contagem.get(r.cpfCnpj) ?? 0) + 1)
  const duplicados = [...contagem.values()].filter((n) => n > 1).length

  // O preview do encerramento é calculado no servidor: a tela nunca decide
  // o que segue, o que fica de fora e por quê (invariantes I1 e I3).
  const gates: Gate[] = [
    { tipo: 'ok', quantidade: prontos.length, texto: 'registros pagos e conciliados', consequencia: 'seguem para protocolo' },
    { tipo: 'alerta', quantidade: semPagamento.length, texto: 'enviados sem pagamento',
      opcoes: ['mover para o próximo lote', 'cancelar com motivo'] },
    { tipo: 'alerta', quantidade: semFicha.length, texto: 'sem ficha associativa assinada',
      opcoes: ['excluir do lote', 'seguir mesmo assim (exige justificativa em auditoria)'] },
    { tipo: 'bloqueio', quantidade: naFila.length, texto: 'comprovantes na fila de conciliação',
      consequencia: 'precisam ser resolvidos antes do encerramento' },
    { tipo: 'info', quantidade: duplicados, texto: 'CPFs duplicados dentro do lote', consequencia: 'revisar' },
  ]

  const valorConciliado = submissoes.filter((s) => s.paymentStatus === 'pago')
    .reduce((a, s) => a + s.valorTotal, 0)
  const valorPendente = submissoes.filter((s) => s.paymentStatus !== 'pago')
    .reduce((a, s) => a + s.valorTotal, 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-marinho">{lote.nome}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Encerra em {lote.closesAt.toLocaleString('pt-BR')} · birôs: {lote.bureaus.join(', ')}
        </p>
      </div>

      <ol className="flex flex-wrap gap-1 text-xs">
        {CICLO.map((etapa) => (
          <li key={etapa}
            className={`rounded-full px-3 py-1 ring-1 ring-inset ${
              etapa === lote.status ? 'bg-azul text-white ring-azul' : 'bg-white text-slate-500 ring-borda'
            }`}>
            {etapa}
          </li>
        ))}
      </ol>

      <div className="grid gap-3 md:grid-cols-4">
        <Card titulo="Registros no lote" valor={String(registros.length)} />
        <Card titulo="Pagos e prontos" valor={String(prontos.length)} tom="bom" />
        <Card titulo="Conciliado" valor={formatarBRL(valorConciliado)} />
        <Card titulo="Pendente" valor={formatarBRL(valorPendente)} tom={valorPendente ? 'alerta' : 'neutro'} />
      </div>

      <Secao titulo="Encerramento — checklist com gates, não botão">
        {pode(sessao.role, 'lote.encerrar') ? (
          <ChecklistEncerramento nomeLote={lote.nome} gates={gates} seguem={prontos.length} />
        ) : (
          <Aviso tom="info">
            Seu papel não encerra lote — a ação pertence ao operador e ao administrador. O preview
            abaixo é somente leitura.
          </Aviso>
        )}
        <Invariante codigo="I3">
          Nenhuma operação em massa sem preview de diff: o encerramento mostra o que vai mudar, o
          que não vai e por quê, exige confirmação digitando o nome do lote, e só então executa —
          devolvendo o relatório do resultado real.
        </Invariante>
      </Secao>

      <Secao titulo="Composição">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="pb-2 pr-3">Parceiro</th>
                <th className="pb-2 pr-3">Nome</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Pago?</th>
                <th className="pb-2 pr-3">Ficha assinada?</th>
                <th className="pb-2 pr-3">Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {registros.map((r) => {
                const a = db.associados.find((x) => x.id === r.associadoId)
                const sub = submissoes.find((s) => s.id === r.submissaoId)
                return (
                  <tr key={r.id}>
                    <td className="py-2 pr-3 text-xs">{db.parceiros.find((p) => p.id === r.parceiroId)?.nomeExibicao}</td>
                    <td className="py-2 pr-3">{r.nome}</td>
                    <td className="py-2 pr-3"><StatusBadge status={r.processStatus} /></td>
                    <td className="py-2 pr-3 text-xs">{sub?.paymentStatus === 'pago' ? '✅' : '—'}</td>
                    <td className="py-2 pr-3 text-xs">
                      {a?.statusFiliacao === 'ativo' ? '✅' : <span className="text-ambar">⚠️ {a?.statusFiliacao}</span>}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{r.origem}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Invariante codigo="I5">
          A coluna de ficha é essencial: ela é o consentimento LGPD do titular. Sem ela, o registro
          não entra em lote encerrado.
        </Invariante>
      </Secao>
    </div>
  )
}
