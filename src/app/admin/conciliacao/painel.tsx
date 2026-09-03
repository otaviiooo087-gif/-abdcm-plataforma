'use client'

import { useActionState, useState } from 'react'
import { REASON_CODES_CONCILIACAO } from '@/domain/pagamentos/reason-codes'
import { aprovarSubmissao, reprovarSubmissao, type EstadoConciliacao } from './actions'

export type ItemFila = {
  id: string
  parceiro: string
  partnerCode: string
  nomesCount: number
  valorEsperado: string
  valorIdentificado: string | null
  divergencia: string | null
  esperaHoras: number
  motivoExcecao: string
  comprovanteManual: boolean
  registros: Array<{ id: string; nome: string; documentoMascarado: string; status: string }>
  historicoParceiro: string
}

const MOTIVOS: Record<string, string> = {
  valor_divergente: 'Valor divergente do esperado',
  sem_webhook_48h: 'Webhook ausente há mais de 48h',
  pix_pago_apos_expirar: 'PIX pago após a expiração',
  pagamento_sem_submissao: 'Pagamento sem submissão identificada',
}

export function PainelConciliacao({ itens, podeAprovar }: { itens: ItemFila[]; podeAprovar: boolean }) {
  const [ativoId, setAtivoId] = useState(itens[0]?.id ?? null)
  const [estadoA, acaoAprovar, pendenteA] = useActionState<EstadoConciliacao, FormData>(aprovarSubmissao, {})
  const [estadoR, acaoReprovar, pendenteR] = useActionState<EstadoConciliacao, FormData>(reprovarSubmissao, {})
  const [mostrarReprovar, setMostrarReprovar] = useState(false)

  const ativo = itens.find((i) => i.id === ativoId) ?? itens[0] ?? null
  const estado = estadoR.erro || estadoR.ok ? estadoR : estadoA

  if (!ativo) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-sm text-emerald-900">
        Fila vazia. Com o webhook funcionando, o caminho feliz é automático e esta fila só recebe
        exceção — é assim que ela deve passar a maior parte do tempo.
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-2">
        {itens.map((i) => (
          <button key={i.id} onClick={() => { setAtivoId(i.id); setMostrarReprovar(false) }}
            className={`w-full rounded-lg border p-3 text-left transition ${
              i.id === ativo.id ? 'border-azul bg-azul-claro' : 'border-borda bg-white hover:border-azul/50'
            }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-marinho">{i.parceiro}</span>
              <span className={`text-xs font-semibold ${i.esperaHoras >= 48 ? 'text-vermelho' : 'text-slate-500'}`}>
                {i.esperaHoras}h
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {i.nomesCount} nomes · esperado {i.valorEsperado}
              {i.valorIdentificado && <> · identificado <strong>{i.valorIdentificado}</strong></>}
            </p>
            <p className="mt-1 text-xs text-ambar">{MOTIVOS[i.motivoExcecao] ?? i.motivoExcecao}</p>
          </button>
        ))}
      </aside>

      <section className="rounded-xl border border-borda bg-white">
        <header className="flex items-start justify-between border-b border-borda p-4">
          <div>
            <h2 className="text-sm font-semibold text-marinho">
              {ativo.parceiro} <span className="font-mono text-xs text-slate-500">{ativo.partnerCode}</span>
            </h2>
            <p className="mt-1 text-xs text-slate-600">{ativo.historicoParceiro}</p>
          </div>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
            {MOTIVOS[ativo.motivoExcecao] ?? ativo.motivoExcecao}
          </span>
        </header>

        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="rounded-lg border border-borda bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comprovante</p>
            <div className="mt-2 flex h-56 items-center justify-center rounded border border-dashed border-slate-300 bg-white text-xs text-slate-400">
              {ativo.comprovanteManual
                ? 'visualizador do comprovante (60% da tela na versão final)'
                : 'sem comprovante — cobrança PIX sem webhook'}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-borda p-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Valor esperado</span>
                <strong className="tabular-nums">{ativo.valorEsperado}</strong>
              </div>
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-slate-600">Valor identificado</span>
                <strong className="tabular-nums">{ativo.valorIdentificado ?? '—'}</strong>
              </div>
              {ativo.divergencia && (
                <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-800">
                  Divergência de {ativo.divergencia}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-borda p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Registros da submissão
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {ativo.registros.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span className="truncate text-slate-700">{r.nome}</span>
                    <span className="shrink-0 font-mono text-slate-500">{r.documentoMascarado}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {estado.erro && (
          <p className="mx-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{estado.erro}</p>
        )}
        {estado.ok && (
          <p className="mx-4 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{estado.ok}</p>
        )}

        <footer className="flex flex-wrap items-center gap-2 border-t border-borda p-4">
          {podeAprovar ? (
            <>
              <form action={acaoAprovar}>
                <input type="hidden" name="submissaoId" value={ativo.id} />
                <button disabled={pendenteA}
                  className="rounded-lg bg-verde px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                  Aprovar <kbd className="ml-1 rounded bg-white/20 px-1 text-[10px]">A</kbd>
                </button>
              </form>
              <button onClick={() => setMostrarReprovar((v) => !v)}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-50">
                Reprovar <kbd className="ml-1 rounded bg-red-100 px-1 text-[10px]">R</kbd>
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Seu papel vê a fila, mas não aprova nem reprova pagamento.
            </p>
          )}
        </footer>

        {mostrarReprovar && podeAprovar && (
          <form action={acaoReprovar} className="space-y-3 border-t border-borda bg-red-50/50 p-4">
            <input type="hidden" name="submissaoId" value={ativo.id} />
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Motivo (lista fechada — obrigatório)
              </label>
              <select name="reasonCode" required
                className="mt-1 w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm">
                {Object.entries(REASON_CODES_CONCILIACAO).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Observação — vai literalmente para o parceiro
              </label>
              <textarea name="observacao" required minLength={5} rows={2}
                placeholder="Ex.: comprovante de R$ 120,00 para uma submissão de R$ 164,70."
                className="mt-1 w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm" />
            </div>
            <button disabled={pendenteR}
              className="rounded-lg bg-vermelho px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Confirmar reprovação
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
