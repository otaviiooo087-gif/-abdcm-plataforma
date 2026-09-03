'use client'

import { useActionState } from 'react'
import { entrar, type EstadoLogin } from './actions'

const CONTAS = [
  ['parceiro@abdcm.org.br', 'Parceiro', 'portal do parceiro'],
  ['conciliador@abdcm.org.br', 'Conciliador', 'fila de conciliação'],
  ['operador@abdcm.org.br', 'Operador', 'lotes e protocolo'],
  ['suporte@abdcm.org.br', 'Suporte', 'contestações'],
  ['financeiro@abdcm.org.br', 'Financeiro', 'ledger e preços'],
  ['admin@abdcm.org.br', 'Administrador', 'acesso completo'],
] as const

export function FormLogin({ senhaDemo }: { senhaDemo: string }) {
  const [estado, acao, pendente] = useActionState<EstadoLogin, FormData>(entrar, {})

  return (
    <div className="w-full max-w-sm">
      <form action={acao} className="rounded-xl border border-borda bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-marinho">Entrar na plataforma</h1>
        <p className="mt-1 text-sm text-slate-600">ABDCM — gestão de ação coletiva</p>

        <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="email">
          E-mail
        </label>
        <input
          id="email" name="email" type="email" required autoComplete="username"
          defaultValue="admin@abdcm.org.br"
          className="mt-1 w-full rounded-lg border border-borda px-3 py-2 text-sm outline-none focus:border-azul focus:ring-2 focus:ring-azul/20"
        />

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="senha">
          Senha
        </label>
        <input
          id="senha" name="senha" type="password" required minLength={8} autoComplete="current-password"
          defaultValue={senhaDemo}
          className="mt-1 w-full rounded-lg border border-borda px-3 py-2 text-sm outline-none focus:border-azul focus:ring-2 focus:ring-azul/20"
        />

        {estado.erro && (
          <p role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {estado.erro}
          </p>
        )}

        <button
          type="submit" disabled={pendente}
          className="mt-5 w-full rounded-lg bg-azul px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {pendente ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <div className="mt-4 rounded-xl border border-borda bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Contas de demonstração
        </p>
        <p className="mt-1 text-xs text-slate-600">
          Clique para preencher. Senha: <code className="rounded bg-slate-100 px-1">{senhaDemo}</code>
        </p>
        <div className="mt-3 grid gap-1.5">
          {CONTAS.map(([email, papel, o_que]) => (
            <button
              key={email} type="button"
              onClick={() => {
                const i = document.getElementById('email') as HTMLInputElement | null
                if (i) i.value = email
              }}
              className="flex items-center justify-between rounded-lg border border-borda px-3 py-2 text-left text-xs transition hover:border-azul hover:bg-azul-claro"
            >
              <span className="font-medium text-marinho">{papel}</span>
              <span className="text-slate-500">{o_que}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
