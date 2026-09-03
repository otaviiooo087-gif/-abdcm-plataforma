import Link from 'next/link'
import { Aviso, Invariante } from '@/components/ui'
import { IconPlus, IconSend, IconUpload } from '@/components/icons'
import { exigirSessao } from '@/lib/sessao-guard'
import { resolverPrecoUnitario } from '@/lib/money'
import { banco, doTenant } from '@/store/repo'
import { StepperEnvio } from './stepper'
import { TabelaEnvio, type LinhaEnvio } from './tabela-envio'

export default async function EnvioDeLista() {
  const sessao = await exigirSessao('portal.parceiro')
  const db = banco()
  const parceiroId = sessao.parceiroId!

  const parceiro = db.parceiros.find((p) => p.id === parceiroId)!
  const lote = doTenant(db.lotes, sessao.tenantId).find((l) => l.status === 'aberto')!
  const registros = doTenant(db.registros, sessao.tenantId).filter(
    (r) => r.parceiroId === parceiroId && r.loteId === lote.id && r.processStatus === 'pendente',
  )

  const preco = resolverPrecoUnitario({
    precoParceiro: parceiro.precoPorNome,
    precoLote: lote.precoPorNome,
    precoPadraoTenant: db.precoPadraoTenant,
  })

  // A validação de envio roda no servidor: ficha assinada, lote aberto,
  // registro não bloqueado. A tela só mostra o resultado dela.
  const linhas: LinhaEnvio[] = registros.map((r) => {
    const a = db.associados.find((x) => x.id === r.associadoId)
    const impedimentos: string[] = []
    if (a?.statusFiliacao !== 'ativo') impedimentos.push('ficha associativa não assinada')
    if (r.isLocked) impedimentos.push('registro bloqueado')
    if (lote.status !== 'aberto') impedimentos.push('lote não está aberto')
    return {
      id: r.id,
      nome: r.nome,
      ficha: a?.statusFiliacao === 'ativo' ? 'assinada' : (a?.statusFiliacao ?? '—'),
      origem: r.origem,
      preco: r.isBonus ? 0 : preco.preco,
      bonus: r.isBonus,
      impedimentos,
    }
  })

  const bloqueadas = linhas.filter((l) => l.impedimentos.length > 0).length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-azul-claro text-azul">
            <IconSend className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-marinho">Envio de Lista</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Cobrança pré-paga e integral, PIX como único meio de pagamento. O preço é congelado
              no registro no instante do envio.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-marinho px-3 py-1.5 text-xs font-semibold text-white">
          {lote.nome}
        </span>
      </div>

      <StepperEnvio atual={2} />

      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          href="/app/associados"
          className="flex items-center gap-2 rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <IconPlus className="h-4 w-4" />
          Cadastrar Nomes
        </Link>
        <button
          disabled
          title="Importação de planilha chega na Fase 1"
          className="flex items-center gap-2 rounded-lg border border-borda bg-white px-4 py-2 text-sm font-semibold text-marinho transition enabled:hover:border-azul enabled:hover:text-azul disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconUpload className="h-4 w-4" />
          Importar Lista (Excel)
        </button>
      </div>

      <section className="rounded-xl border border-borda bg-white p-4">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-marinho">
            Nomes cadastrados — {lote.nome}{' '}
            <span className="font-normal text-slate-400">
              ({linhas.length} total{bloqueadas > 0 ? ` · ${bloqueadas} bloqueados` : ''})
            </span>
          </h2>
        </header>

        <TabelaEnvio linhas={linhas} precoUnitario={preco.preco} origemPreco={preco.origem} />

        {bloqueadas > 0 && (
          <div className="mt-3">
            <Aviso tom="alerta">
              {bloqueadas} registros não entram nesta submissão. O motivo aparece linha a linha —
              o servidor recusaria o envio de qualquer forma, mesmo que a tela deixasse marcar.
            </Aviso>
          </div>
        )}

        <div className="mt-4 space-y-2 border-t border-dashed border-borda pt-3">
          <Invariante codigo="I3">
            O envio segue o padrão de operação em massa: carregar, mostrar o que vai e o que não
            vai e por quê, confirmar, executar, relatar o resultado real. Nunca “selecionar tudo →
            aplicar”.
          </Invariante>
          <Invariante codigo="I4">
            Ao confirmar, cada registro grava o unit_price resolvido agora e passa a ser imutável.
            Ajuste posterior existe só como lançamento no ledger.
          </Invariante>
          <Invariante codigo="I1">
            O botão desta tela não decide nada: ele pede ao servidor, que revalida ficha, lote e
            bloqueio antes de criar a submissão e a cobrança PIX.
          </Invariante>
        </div>
      </section>
    </div>
  )
}
