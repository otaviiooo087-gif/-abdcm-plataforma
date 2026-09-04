'use client'

import { useState } from 'react'
import { IconCheck, IconCopy, IconCreditCard } from '@/components/icons'
import { CONTA_INSTITUCIONAL } from '@/lib/conta-institucional'

export function ContaInstitucional() {
  const [copiado, setCopiado] = useState(false)

  async function copiarChavePix() {
    try {
      await navigator.clipboard.writeText(CONTA_INSTITUCIONAL.chavePix)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      // Ambiente sem permissão de clipboard — sem efeito colateral no domínio.
    }
  }

  return (
    <div className="rounded-xl border border-borda bg-white p-4">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
            <IconCreditCard className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-marinho">
                Conta institucional &amp; chave PIX (ABDCM)
              </h3>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> operando ativa
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Razão social: <strong>{CONTA_INSTITUCIONAL.razaoSocial}</strong> · CNPJ: {CONTA_INSTITUCIONAL.cnpj}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-borda bg-slate-50 px-3 py-2 text-xs">
            <span className="text-[10px] font-bold uppercase text-slate-400">Chave PIX:</span>
            <span className="font-mono font-semibold text-slate-800">{CONTA_INSTITUCIONAL.chavePix}</span>
            <button type="button" onClick={copiarChavePix} title="Copiar chave PIX"
              className="rounded p-1 text-azul transition hover:bg-azul-claro">
              {copiado
                ? <span className="flex items-center gap-1 text-xs font-semibold text-verde"><IconCheck className="h-3.5 w-3.5" /> copiado</span>
                : <IconCopy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="rounded-lg border border-borda bg-slate-50 px-3 py-2 text-xs">
            <span className="mr-2 text-[10px] font-bold uppercase text-slate-400">Bancos:</span>
            <span className="font-semibold text-slate-800">{CONTA_INSTITUCIONAL.bancos}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
