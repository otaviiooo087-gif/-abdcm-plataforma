'use client'

import { useState } from 'react'

export type Gate = {
  tipo: 'ok' | 'alerta' | 'bloqueio' | 'info'
  quantidade: number
  texto: string
  consequencia?: string
  opcoes?: string[]
}

const ICONE = { ok: '✅', alerta: '⚠️', bloqueio: '❌', info: 'ℹ️' } as const

export function ChecklistEncerramento({
  nomeLote, gates, seguem,
}: { nomeLote: string; gates: Gate[]; seguem: number }) {
  const [confirmacao, setConfirmacao] = useState('')
  const [escolhas, setEscolhas] = useState<Record<number, string>>({})

  const bloqueios = gates.filter((g) => g.tipo === 'bloqueio' && g.quantidade > 0)
  const pendentes = gates.filter((g, i) => g.opcoes && g.quantidade > 0 && !escolhas[i])
  const nomeConfere = confirmacao.trim().toUpperCase() === nomeLote.toUpperCase()
  const liberado = bloqueios.length === 0 && pendentes.length === 0 && nomeConfere

  return (
    <div className="rounded-lg border border-borda bg-slate-50 p-4 font-mono text-sm">
      <p className="font-semibold text-marinho">Encerrar {nomeLote}</p>

      <ul className="mt-3 space-y-2">
        {gates.map((g, i) => (
          <li key={i} className={g.quantidade === 0 ? 'text-slate-400' : ''}>
            <div className="flex flex-wrap items-baseline gap-2">
              <span>{ICONE[g.tipo]}</span>
              <span className="w-8 text-right tabular-nums font-semibold">{g.quantidade}</span>
              <span>{g.texto}</span>
              {g.consequencia && <span className="text-slate-500">→ {g.consequencia}</span>}
            </div>
            {g.opcoes && g.quantidade > 0 && (
              <div className="ml-12 mt-1 flex flex-wrap gap-3">
                {g.opcoes.map((o) => (
                  <label key={o} className="flex items-center gap-1.5 text-xs">
                    <input type="radio" name={`gate-${i}`} checked={escolhas[i] === o}
                      onChange={() => setEscolhas((e) => ({ ...e, [i]: o }))} />
                    {o}
                  </label>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <hr className="my-4 border-borda" />

      <p className="text-xs leading-relaxed text-slate-600">
        Ao encerrar: {seguem} registros congelados, protocolo individual gerado, parceiros
        notificados, próximo lote aberto automaticamente.
      </p>

      {bloqueios.length > 0 && (
        <p className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
          Bloqueado: {bloqueios.map((b) => `${b.quantidade} ${b.texto}`).join(' · ')}. Resolva na
          fila de conciliação antes de encerrar.
        </p>
      )}
      {pendentes.length > 0 && (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Escolha o destino de cada grupo em alerta antes de continuar.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)}
          placeholder={`digite ${nomeLote} para confirmar`}
          className="min-w-64 flex-1 rounded border border-borda bg-white px-3 py-2 text-xs" />
        <button disabled={!liberado}
          title={liberado ? undefined : 'Resolva os gates e digite o nome do lote'}
          className="rounded bg-vermelho px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
          Encerrar lote
        </button>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Na Fase 1 este botão executa a operação e devolve o relatório real. Nesta fase ele mostra
        o preview e os gates — o servidor revalida tudo de novo antes de aplicar qualquer mudança.
      </p>
    </div>
  )
}
