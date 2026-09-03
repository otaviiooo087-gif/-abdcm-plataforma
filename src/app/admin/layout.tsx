import Link from 'next/link'
import { exigirSessao } from '@/lib/sessao-guard'
import { pode, ROLE_LABELS, type Permissao } from '@/lib/authz'
import { sair } from '../login/actions'

const NAV: Array<{ href: string; nome: string; permissao: Permissao }> = [
  { href: '/admin', nome: 'Painel do dia', permissao: 'admin.acessar' },
  { href: '/admin/conciliacao', nome: 'Conciliação', permissao: 'conciliacao.ver' },
  { href: '/admin/lote', nome: 'Console do lote', permissao: 'lote.ver' },
  { href: '/admin/registros', nome: 'Registros', permissao: 'registro.ver' },
  { href: '/admin/contestacoes', nome: 'Contestações', permissao: 'contestacao.ver' },
  { href: '/admin/auditoria', nome: 'Auditoria', permissao: 'auditoria.ver' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao('admin.acessar')

  // O menu é montado no servidor a partir da matriz de permissões: o item
  // que o papel não pode acessar não é escondido no cliente, ele não existe
  // no HTML — e a rota correspondente valida de novo (invariante I1).
  const itens = NAV.filter((i) => pode(sessao.role, i.permissao))

  return (
    <div className="min-h-screen">
      <header className="border-b border-borda bg-marinho text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm font-semibold tracking-wide">
              ABDCM <span className="font-normal text-white/60">console administrativo</span>
            </Link>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-white/70">
              {sessao.nome} · <strong className="text-white">{ROLE_LABELS[sessao.role]}</strong>
            </span>
            <form action={sair}>
              <button className="rounded border border-white/25 px-2.5 py-1 transition hover:bg-white/10">
                Sair
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {itens.map((i) => (
            <Link key={i.href} href={i.href}
              className="whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-xs font-medium text-white/75 transition hover:border-white/40 hover:text-white">
              {i.nome}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}
