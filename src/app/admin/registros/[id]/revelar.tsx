'use client'

import { useState, useTransition } from 'react'
import { revelarDocumento } from '../actions'

export function BotaoRevelar({ registroId, mascarado }: { registroId: string; mascarado: string }) {
  const [valor, setValor] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-sm text-marinho">{valor ?? mascarado}</span>
      {!valor && (
        <button
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await revelarDocumento(registroId)
              if ('erro' in r) setErro(r.erro)
              else { setValor(r.documento); setErro(null) }
            })
          }
          className="rounded border border-borda px-2 py-0.5 text-xs font-medium text-azul transition hover:bg-azul-claro disabled:opacity-50"
        >
          {pendente ? 'revelando…' : 'revelar'}
        </button>
      )}
      {valor && <span className="text-xs text-ambar">revelação registrada em auditoria</span>}
      {erro && <span className="text-xs text-vermelho">{erro}</span>}
    </div>
  )
}
