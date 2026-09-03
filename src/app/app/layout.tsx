import Link from 'next/link'
import { exigirSessao } from '@/lib/sessao-guard'
import { IconHome, IconLogout, IconSend, IconUsers } from '@/components/icons'
import { sair } from '../login/actions'

const NAV = [
  { href: '/app', nome: 'Dashboard', Icone: IconHome },
  { href: '/app/associados', nome: 'Associados', Icone: IconUsers },
  { href: '/app/envio', nome: 'Envio de Lista', Icone: IconSend },
]

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const sessao = await exigirSessao('portal.parceiro')

  return (
    <div className="min-h-screen lg:flex">
      {/* --------------------------------------------------------------- sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-marinho text-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 text-base font-bold">
            A
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-wide">ABDCM</p>
            <p className="text-[11px] text-white/55">portal do parceiro</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <p className="px-2 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-widest text-white/40">
            Ação coletiva
          </p>
          <ul className="space-y-0.5">
            {NAV.map(({ href, nome, Icone }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
                >
                  <Icone className="h-[18px] w-[18px] shrink-0" />
                  {nome}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-white/10 px-3 py-3">
          <form action={sair}>
            <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-white/60 transition hover:bg-white/10 hover:text-white">
              <IconLogout className="h-[18px] w-[18px]" />
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* ---------------------------------------------------------------- corpo */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-borda bg-white px-4 py-3 lg:px-6">
          <Link href="/app" className="text-sm font-semibold text-marinho lg:hidden">
            ABDCM <span className="font-normal text-slate-500">portal do parceiro</span>
          </Link>
          <span className="hidden text-xs text-slate-400 lg:inline">Portal do parceiro</span>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-xs font-medium text-marinho">{sessao.nome}</p>
              <p className="text-[11px] text-slate-400">parceiro</p>
            </div>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-azul-claro text-xs font-semibold text-azul">
              {sessao.nome.charAt(0)}
            </span>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-6">{children}</main>

        {/* navegação inferior no celular, mesmos destinos da sidebar */}
        <nav className="sticky bottom-0 flex justify-around border-t border-borda bg-white py-1.5 lg:hidden">
          {NAV.map(({ href, nome, Icone }) => (
            <Link key={href} href={href} className="flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] text-slate-500">
              <Icone className="h-5 w-5" />
              {nome}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
