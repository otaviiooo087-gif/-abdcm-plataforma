import type { ProcessStatus } from '@/domain/registros/state-machine'

const CORES: Record<ProcessStatus, string> = {
  pendente: 'bg-slate-100 text-slate-700 ring-slate-200',
  enviado: 'bg-sky-50 text-sky-800 ring-sky-200',
  aguardando_pagamento: 'bg-amber-50 text-amber-800 ring-amber-200',
  pago: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  reprovado: 'bg-red-50 text-red-800 ring-red-200',
  aguardando_protocolo: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  protocolado: 'bg-blue-50 text-blue-800 ring-blue-200',
  baixado: 'bg-teal-50 text-teal-900 ring-teal-300',
  recusado: 'bg-rose-50 text-rose-800 ring-rose-200',
  cancelado: 'bg-neutral-100 text-neutral-600 ring-neutral-300',
}

export function StatusBadge({ status }: { status: ProcessStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${CORES[status]}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export function Card({
  titulo, valor, detalhe, tom = 'neutro', href,
}: { titulo: string; valor: string; detalhe?: string; tom?: 'neutro' | 'alerta' | 'critico' | 'bom'; href?: string }) {
  const tons = {
    neutro: 'border-borda bg-white',
    alerta: 'border-amber-300 bg-amber-50',
    critico: 'border-red-300 bg-red-50',
    bom: 'border-emerald-300 bg-emerald-50',
  }
  const conteudo = (
    <div className={`rounded-xl border p-4 ${tons[tom]} ${href ? 'transition hover:shadow-md' : ''}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-slate-600">{detalhe}</p>}
    </div>
  )
  return href ? <a href={href} className="block">{conteudo}</a> : conteudo
}

export function Secao({ titulo, acao, children }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-borda bg-white">
      <header className="flex items-center justify-between border-b border-borda px-4 py-3">
        <h2 className="text-sm font-semibold text-marinho">{titulo}</h2>
        {acao}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Aviso({ tom = 'info', children }: { tom?: 'info' | 'alerta' | 'critico'; children: React.ReactNode }) {
  const tons = {
    info: 'border-azul/30 bg-azul-claro text-marinho',
    alerta: 'border-amber-300 bg-amber-50 text-amber-900',
    critico: 'border-red-300 bg-red-50 text-red-900',
  }
  return <div className={`rounded-lg border px-3 py-2 text-sm ${tons[tom]}`}>{children}</div>
}

export function Invariante({ codigo, children }: { codigo: string; children: React.ReactNode }) {
  return (
    <p className="mt-2 flex gap-2 text-xs text-slate-500">
      <span className="shrink-0 rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
        {codigo}
      </span>
      <span>{children}</span>
    </p>
  )
}
