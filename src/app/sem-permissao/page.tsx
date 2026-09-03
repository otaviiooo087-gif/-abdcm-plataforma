import Link from 'next/link'
import { sessaoAtual } from '@/lib/auth'
import { permissoesDe, ROLE_LABELS } from '@/lib/authz'

export default async function SemPermissao() {
  const sessao = await sessaoAtual()

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4">
      <div className="rounded-xl border border-red-300 bg-red-50 p-6">
        <h1 className="text-lg font-semibold text-red-900">Acesso negado</h1>
        <p className="mt-2 text-sm text-red-800">
          O papel <strong>{sessao ? ROLE_LABELS[sessao.role] : '—'}</strong> não tem permissão para
          esta tela. A verificação acontece no servidor, antes de qualquer dado ser lido: a rota não
          devolve conteúdo parcial nem esconde botões no cliente.
        </p>
        {sessao && (
          <div className="mt-4 rounded-lg border border-red-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Permissões deste papel
            </p>
            <p className="mt-1 font-mono text-xs text-slate-700">{permissoesDe(sessao.role).join(' · ')}</p>
          </div>
        )}
        <Link href="/admin" className="mt-5 inline-block text-sm font-semibold text-azul underline">
          Voltar ao console
        </Link>
      </div>
    </main>
  )
}
