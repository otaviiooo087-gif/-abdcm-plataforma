import { Card, Invariante } from '@/components/ui'
import { exigirSessao } from '@/lib/sessao-guard'
import { pode } from '@/lib/authz'
import { mascararDocumento } from '@/lib/documento'
import { formatarBRL } from '@/lib/money'
import { banco, doTenant } from '@/store/repo'
import { AbasFinanceiro } from './abas'
import { ContaInstitucional } from './conta-institucional'
import { DesempenhoParceiros, type LinhaParceiro } from './desempenho-parceiros'
import { ExtratoFinanceiro, type LinhaExtrato } from './extrato'
import { PainelConciliacao, type ItemFila } from './painel'

const NOMES_PAGOS_OU_ADIANTE = new Set(['pago', 'aguardando_protocolo', 'protocolado', 'baixado'])

export default async function Conciliacao() {
  // A permissão é verificada antes de qualquer leitura de dado.
  const sessao = await exigirSessao('conciliacao.ver')
  const db = await banco(sessao.tenantId)
  const t = sessao.tenantId

  const todasSubmissoes = doTenant(db.submissoes, t)
  const todosRegistros = doTenant(db.registros, t)
  const parceiros = doTenant(db.parceiros, t)

  const filaExcecao = todasSubmissoes.filter((s) => s.paymentStatus === 'pendente' && s.motivoExcecao)

  const itens: ItemFila[] = filaExcecao.map((s) => {
    const parceiro = parceiros.find((p) => p.id === s.parceiroId)!
    const registros = todosRegistros.filter((r) => r.submissaoId === s.id)
    const div = s.valorIdentificado != null ? s.valorTotal - s.valorIdentificado : null
    return {
      id: s.id,
      parceiro: parceiro.nomeExibicao,
      partnerCode: parceiro.partnerCode,
      nomesCount: s.nomesCount,
      valorEsperado: formatarBRL(s.valorTotal),
      valorIdentificado: s.valorIdentificado != null ? formatarBRL(s.valorIdentificado) : null,
      divergencia: div ? formatarBRL(Math.abs(div)) : null,
      esperaHoras: Math.floor((Date.now() - s.submetidoEm.getTime()) / 3_600_000),
      motivoExcecao: s.motivoExcecao!,
      comprovanteManual: s.comprovanteManual,
      // O documento já sai mascarado do servidor (I6): o valor completo
      // nunca chega ao navegador nesta tela.
      registros: registros.map((r) => ({
        id: r.id, nome: r.nome, documentoMascarado: mascararDocumento(r.cpfCnpj), status: r.processStatus,
      })),
      historicoParceiro: `${parceiro.totalNomesEnviados} nomes enviados no total · ${parceiro.cidade}/${parceiro.uf}`,
    }
  })

  // Métricas do tenant inteiro (não só a fila de exceção): dão o retrato
  // financeiro geral que abre a tela, calculadas no servidor a partir dos
  // mesmos dados — nenhum valor é inventado ou recalculado no cliente.
  const faturamentoConfirmado = todasSubmissoes
    .filter((s) => s.paymentStatus === 'pago')
    .reduce((acc, s) => acc + s.valorTotal, 0)
  const valoresEmConciliacao = todasSubmissoes
    .filter((s) => s.paymentStatus === 'pendente')
    .reduce((acc, s) => acc + s.valorTotal, 0)
  const nomesPagosOuAdiante = todosRegistros.filter((r) => NOMES_PAGOS_OU_ADIANTE.has(r.processStatus)).length
  const parceirosAtivos = parceiros.filter((p) => p.isActive).length

  const linhasExtrato: LinhaExtrato[] = todasSubmissoes
    .map((s) => {
      const parceiro = parceiros.find((p) => p.id === s.parceiroId)
      const lote = db.lotes.find((l) => l.id === s.loteId)
      return {
        id: s.id,
        parceiro: parceiro?.nomeExibicao ?? s.parceiroId,
        lote: lote?.nome ?? s.loteId,
        nomesCount: s.nomesCount,
        valorTotal: s.valorTotal,
        status: s.paymentStatus,
        submetidoEmIso: s.submetidoEm.toISOString(),
        motivoObservacao: s.motivoObservacao,
      }
    })
    .sort((a, b) => b.submetidoEmIso.localeCompare(a.submetidoEmIso))

  const linhasParceiros: LinhaParceiro[] = parceiros.map((p) => {
    const submissoesPagas = todasSubmissoes.filter((s) => s.parceiroId === p.id && s.paymentStatus === 'pago')
    return {
      id: p.id,
      nomeExibicao: p.nomeExibicao,
      partnerCode: p.partnerCode,
      cidadeUf: `${p.cidade}/${p.uf}`,
      totalNomesEnviados: p.totalNomesEnviados,
      nomesPagos: todosRegistros.filter((r) => r.parceiroId === p.id && NOMES_PAGOS_OU_ADIANTE.has(r.processStatus)).length,
      faturamentoPago: submissoesPagas.reduce((acc, s) => acc + s.valorTotal, 0),
      precoPorNome: p.precoPorNome ?? db.precoPadraoTenant,
    }
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-marinho">Financeiro &amp; Conciliação</h1>
        <p className="mt-1 text-sm text-slate-600">
          Com o webhook do PIX funcionando, o caminho feliz é automático. A fila de conciliação só
          recebe exceção: valor divergente, PIX pago após expirar, pagamento sem submissão
          identificada, comprovante manual, webhook ausente.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card titulo="Faturamento confirmado" valor={formatarBRL(faturamentoConfirmado)}
          detalhe="submissões conciliadas e pagas" tom="bom" />
        <Card titulo="Valores em conciliação" valor={formatarBRL(valoresEmConciliacao)}
          detalhe={`${todasSubmissoes.filter((s) => s.paymentStatus === 'pendente').length} submissão(ões) pendente(s)`}
          tom={valoresEmConciliacao ? 'alerta' : 'neutro'} />
        <Card titulo="Nomes pagos e prontos" valor={String(nomesPagosOuAdiante)}
          detalhe="pago, aguardando protocolo, protocolado ou baixado" />
        <Card titulo="Parceiros ativos" valor={String(parceirosAtivos)}
          detalhe={`${parceiros.length} cadastrado(s) no tenant`} />
      </div>

      <ContaInstitucional />

      <AbasFinanceiro
        filaPendenteCount={itens.length}
        abaConciliacao={<PainelConciliacao itens={itens} podeAprovar={pode(sessao.role, 'conciliacao.aprovar')} />}
        abaExtrato={<ExtratoFinanceiro transacoes={linhasExtrato} />}
        abaParceiros={<DesempenhoParceiros parceiros={linhasParceiros} />}
      />

      <div className="rounded-xl border border-borda bg-white p-4">
        <Invariante codigo="I11">
          Reprovar exige código de motivo de lista fechada mais observação livre. O texto vai
          literalmente para o parceiro, e o código é o que permite medir qualidade depois.
        </Invariante>
        <Invariante codigo="I2">
          Aprovar transiciona cada registro pelo caminho único do domínio, gravando um ProcessEvent
          por registro — inclusive na operação em massa da submissão inteira.
        </Invariante>
        <Invariante codigo="I6">
          Os documentos da submissão chegam ao navegador já mascarados; o servidor não envia o
          valor completo para esta tela.
        </Invariante>
      </div>
    </div>
  )
}
