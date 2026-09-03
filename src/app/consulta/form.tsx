'use client'

import { useActionState } from 'react'
import { StatusBadge } from '@/components/ui'
import { consultar, type ResultadoConsulta } from './actions'

export function FormConsulta({ exemplo }: { exemplo: { documento: string; protocolo: string } | null }) {
  const [estado, acao, pendente] = useActionState<ResultadoConsulta, FormData>(consultar, {})

  return (
    <div className="space-y-5">
      <form action={acao} className="rounded-xl border border-borda bg-white p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <label htmlFor="documento" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              CPF ou CNPJ
            </label>
            <input id="documento" name="documento" required defaultValue={exemplo?.documento ?? ''}
              placeholder="000.000.000-00"
              className="mt-1 w-full rounded-lg border border-borda px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="protocolo" className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Número do protocolo
            </label>
            <input id="protocolo" name="protocolo" required defaultValue={exemplo?.protocolo ?? ''}
              placeholder="AC124-0001"
              className="mt-1 w-full rounded-lg border border-borda px-3 py-2 text-sm" />
          </div>
          <div className="flex items-end">
            <button disabled={pendente}
              className="w-full rounded-lg bg-azul px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 md:w-auto">
              {pendente ? 'Consultando…' : 'Consultar'}
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          O protocolo é obrigatório: o CPF sozinho não devolve informação alguma, e a resposta para
          protocolo errado é idêntica à de CPF inexistente.
        </p>
      </form>

      {estado.erro && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {estado.erro}
        </div>
      )}

      {estado.encontrado && (
        <div className="rounded-xl border border-borda bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Protocolo</p>
              <p className="font-mono text-lg font-semibold text-marinho">{estado.encontrado.protocolo}</p>
              <p className="mt-1 text-xs text-slate-500">{estado.encontrado.lote}</p>
            </div>
            <div className="text-right">
              <StatusBadge status={estado.encontrado.statusAtual} />
              <p className="mt-1 max-w-xs text-xs text-slate-600">{estado.encontrado.descricao}</p>
            </div>
          </div>

          <h2 className="mt-6 text-sm font-semibold text-marinho">Timeline do processo</h2>
          <ol className="mt-3 space-y-3 border-l border-borda pl-5">
            {estado.encontrado.eventos.map((e, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-azul ring-4 ring-azul-claro" />
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={e.para} />
                  <span className="text-xs text-slate-500">{e.quando}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-600">{e.descricao}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-slate-500">
            A consulta devolve a timeline inteira, não apenas o status atual — é o que reduz a
            necessidade de o associado abrir contestação para saber onde o processo está.
          </p>
        </div>
      )}
    </div>
  )
}
