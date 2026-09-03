import Link from 'next/link'
import { exigirSessao } from '@/lib/sessao-guard'
import { sair } from '../login/actions'

const NAV = [
  { href: '/app', nome: 'Dashboard' },
  { href: '/app/associados', nome: 'Associados' },
  { href: '/app/envio', nome: 'Envio de lista' },
]

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao('portal.parceiro')

  return (
    <div className="min-h-screen">
      <header className="border-b border-borda bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/app" className="text-sm font-semibold text-marinho">
            ABDCM <span className="font-normal text-slate-500">portal do parceiro</span>
          </Link>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-600">{sessao.nome}</span>
            <form action={sair}>
              <button className="rounded border border-borda px-2.5 py-1 transition hover:bg-slate-50">Sair</button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4">
          {NAV.map((i) => (
            <Link key={i.href} href={i.href}
              className="border-b-2 border-transparent px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-azul hover:text-azul">
              {i.nome}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
