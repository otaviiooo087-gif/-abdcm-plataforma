import { Aviso, Invariante, Secao } from '@/components/ui'
import { exigirSessao } from '@/lib/sessao-guard'
import { formatarBRL, resolverPrecoUnitario, somar } from '@/lib/money'
import { banco, doTenant } from '@/store/repo'

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
  const avaliados = registros.map((r) => {
    const a = db.associados.find((x) => x.id === r.associadoId)
    const impedimentos: string[] = []
    if (a?.statusFiliacao !== 'ativo') impedimentos.push('ficha associativa não assinada')
    if (r.isLocked) impedimentos.push('registro bloqueado')
    if (lote.status !== 'aberto') impedimentos.push('lote não está aberto')
    return { registro: r, associado: a, impedimentos, preco: r.isBonus ? 0 : preco.preco }
  })

  const elegiveis = avaliados.filter((x) => x.impedimentos.length === 0)
  const bloqueados = avaliados.filter((x) => x.impedimentos.length > 0)
  const total = somar(elegiveis.map((e) => e.preco))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-marinho">Envio de lista — {lote.nome}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cobrança pré-paga e integral, PIX como único meio de pagamento. O preço é congelado no
          registro no instante do envio.
        </p>
      </div>

      <Secao titulo={`${elegiveis.length} registros elegíveis · ${bloqueados.length} bloqueados`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="pb-2 pr-3"><input type="checkbox" defaultChecked disabled /></th>
                <th className="pb-2 pr-3">Nome</th>
                <th className="pb-2 pr-3">Ficha</th>
                <th className="pb-2 pr-3">Origem</th>
                <th className="pb-2 pr-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {avaliados.map(({ registro, associado, impedimentos, preco: p }) => (
                <tr key={registro.id} className={impedimentos.length ? 'bg-amber-50/60' : ''}>
                  <td className="py-2 pr-3">
                    <input type="checkbox" defaultChecked={!impedimentos.length} disabled={!!impedimentos.length} />
                  </td>
                  <td className="py-2 pr-3">
                    <span className="font-medium text-marinho">{registro.nome}</span>
                    {impedimentos.length > 0 && (
                      <p className="text-xs text-ambar">{impedimentos.join(' · ')}</p>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {associado?.statusFiliacao === 'ativo'
                      ? <span className="text-verde">assinada</span>
                      : <span className="text-ambar">{associado?.statusFiliacao}</span>}
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-500">{registro.origem}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {registro.isBonus ? <span className="text-verde">bônus</span> : formatarBRL(p)}
                  </td>
                </tr>
              ))}
              {avaliados.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                  Nenhum registro pendente neste lote.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-borda bg-slate-50 p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Valor total da submissão</p>
            <p className="text-2xl font-semibold tabular-nums text-marinho">{formatarBRL(total)}</p>
            <p className="text-xs text-slate-600">
              {elegiveis.length} nomes × {formatarBRL(preco.preco)} (preço do {preco.origem})
            </p>
          </div>
          <button disabled className="rounded-lg bg-azul px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            Enviar lista e gerar PIX
          </button>
        </div>

        {bloqueados.length > 0 && (
          <Aviso tom="alerta">
            {bloqueados.length} registros não entram nesta submissão. O motivo aparece linha a
            linha — o servidor recusaria o envio de qualquer forma, mesmo que a tela deixasse
            marcar.
          </Aviso>
        )}

        <Invariante codigo="I3">
          O envio segue o padrão de operação em massa: carregar, mostrar o que vai e o que não vai
          e por quê, confirmar, executar, relatar o resultado real. Nunca “selecionar tudo → aplicar”.
        </Invariante>
        <Invariante codigo="I4">
          Ao confirmar, cada registro grava o unit_price resolvido agora e passa a ser imutável.
          Ajuste posterior existe só como lançamento no ledger.
        </Invariante>
        <Invariante codigo="I1">
          O botão desta tela não decide nada: ele pede ao servidor, que revalida ficha, lote e
          bloqueio antes de criar a submissão e a cobrança PIX.
        </Invariante>
      </Secao>
    </div>
  )
}
