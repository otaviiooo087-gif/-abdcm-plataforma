import { Invariante } from '@/components/ui'
import { exigirSessao } from '@/lib/sessao-guard'
import { pode } from '@/lib/authz'
import { mascararDocumento } from '@/lib/documento'
import { formatarBRL } from '@/lib/money'
import { banco, doTenant } from '@/store/repo'
import { PainelConciliacao, type ItemFila } from './painel'

export default async function Conciliacao() {
  // A permissão é verificada antes de qualquer leitura de dado.
  const sessao = await exigirSessao('conciliacao.ver')
  const db = await banco(sessao.tenantId)

  const submissoes = doTenant(db.submissoes, sessao.tenantId).filter(
    (s) => s.paymentStatus === 'pendente' && s.motivoExcecao,
  )

  const itens: ItemFila[] = submissoes.map((s) => {
    const parceiro = db.parceiros.find((p) => p.id === s.parceiroId)!
    const registros = doTenant(db.registros, sessao.tenantId).filter((r) => r.submissaoId === s.id)
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-marinho">Fila de conciliação</h1>
        <p className="mt-1 text-sm text-slate-600">
          Com o webhook do PIX funcionando, o caminho feliz é automático. Esta fila só recebe
          exceção: valor divergente, PIX pago após expirar, pagamento sem submissão identificada,
          comprovante manual, webhook ausente.
        </p>
      </div>

      <PainelConciliacao itens={itens} podeAprovar={pode(sessao.role, 'conciliacao.aprovar')} />

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
