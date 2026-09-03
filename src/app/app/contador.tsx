'use client'

import { useEffect, useState } from 'react'

export function Contador({ alvoISO }: { alvoISO: string }) {
  const alvo = new Date(alvoISO).getTime()
  const [agora, setAgora] = useState<number | null>(null)

  useEffect(() => {
    setAgora(Date.now())
    const id = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const restante = Math.max(0, alvo - (agora ?? alvo))
  const d = Math.floor(restante / 86_400_000)
  const h = Math.floor((restante % 86_400_000) / 3_600_000)
  const m = Math.floor((restante % 3_600_000) / 60_000)
  const s = Math.floor((restante % 60_000) / 1000)
  const partes: Array<[number, string]> = [[d, 'dias'], [h, 'horas'], [m, 'min'], [s, 'seg']]

  return (
    <div className="flex gap-3">
      {partes.map(([v, r]) => (
        <div key={r} className="rounded-lg bg-marinho px-3 py-2 text-center text-white">
          <p className="text-xl font-semibold tabular-nums">
            {agora === null ? '--' : String(v).padStart(2, '0')}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-white/60">{r}</p>
        </div>
      ))}
    </div>
  )
}
