'use client'

import { useState, type ReactNode } from 'react'
import { IconBuilding, IconClipboard, IconCreditCard } from '@/components/icons'

type Aba = 'conciliacao' | 'extrato' | 'parceiros'

export function AbasFinanceiro({
  filaPendenteCount, abaConciliacao, abaExtrato, abaParceiros,
}: {
  filaPendenteCount: number
  abaConciliacao: ReactNode
  abaExtrato: ReactNode
  abaParceiros: ReactNode
}) {
  const [aba, setAba] = useState<Aba>('conciliacao')

  const botao = (valor: Aba, rotulo: string, icone: ReactNode, contagem?: number) => (
    <button type="button" onClick={() => setAba(valor)}
      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
        aba === valor ? 'bg-azul text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
      }`}>
      {icone}
      {rotulo}
      {!!contagem && (
        <span className="rounded-full bg-ambar px-1.5 py-0.5 text-[10px] font-black text-white">{contagem}</span>
      )}
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-borda pb-2">
        {botao('conciliacao', 'Fila de conciliação', <IconClipboard className="h-3.5 w-3.5" />, filaPendenteCount)}
        {botao('extrato', 'Extrato financeiro & histórico', <IconCreditCard className="h-3.5 w-3.5" />)}
        {botao('parceiros', 'Desempenho por parceiro', <IconBuilding className="h-3.5 w-3.5" />)}
      </div>

      <div hidden={aba !== 'conciliacao'}>{abaConciliacao}</div>
      <div hidden={aba !== 'extrato'}>{abaExtrato}</div>
      <div hidden={aba !== 'parceiros'}>{abaParceiros}</div>
    </div>
  )
}
