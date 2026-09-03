import Link from 'next/link'
import { sessaoAtual } from '@/lib/auth'
import { ROLE_LABELS } from '@/lib/authz'

const SUPERFICIES = [
  { href: '/app', nome: 'Portal do parceiro', dominio: 'app.abdcm.org.br', quem: 'parceiro autenticado',
    desc: 'Filiação de associados, cadastro no lote vigente, envio de lista com PIX e acompanhamento.' },
  { href: '/admin', nome: 'Console administrativo', dominio: 'admin.abdcm.org.br', quem: 'equipe ABDCM, por papel',
    desc: 'Painel do dia, fila de conciliação, console do lote, auditoria — organizado por filas com prazo.' },
  { href: '/consulta', nome: 'Consulta pública', dominio: 'consulta.abdcm.org.br', quem: 'qualquer pessoa, sem login',
    desc: 'CPF + protocolo devolvem a timeline do processo. Sem login, com rate limiting.' },
]

export default async function Home() {
  const sessao = await sessaoAtual()

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-azul">ABDCM</p>
      <h1 className="mt-2 text-3xl font-semibold text-marinho">Plataforma de Ação Coletiva</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
        Fase 0 — fundação. Três superfícies em um projeto, autenticação com seis papéis, máquina de
        estados como domínio puro e os invariantes de segurança aplicados no servidor.
      </p>

      {sessao ? (
        <p className="mt-4 inline-block rounded-lg border border-borda bg-white px-3 py-2 text-sm">
          Sessão ativa: <strong>{sessao.nome}</strong> · {ROLE_LABELS[sessao.role]}
        </p>
      ) : (
        <Link href="/login" className="mt-4 inline-block rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white">
          Entrar
        </Link>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {SUPERFICIES.map((s) => (
          <Link key={s.href} href={s.href}
            className="rounded-xl border border-borda bg-white p-5 transition hover:border-azul hover:shadow-md">
            <p className="text-sm font-semibold text-marinho">{s.nome}</p>
            <p className="mt-1 font-mono text-xs text-azul">{s.dominio}</p>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">{s.desc}</p>
            <p className="mt-3 text-xs text-slate-500">Acesso: {s.quem}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-borda bg-white p-5">
        <h2 className="text-sm font-semibold text-marinho">O que já está garantido por estrutura</h2>
        <ul className="mt-3 grid gap-2 text-xs leading-relaxed text-slate-600 md:grid-cols-2">
          <li><strong>I1</strong> — nenhuma regra de negócio no cliente; o navegador nunca fala com o banco.</li>
          <li><strong>I2</strong> — toda transição grava ProcessEvent; não existe caminho que altere status sem ele.</li>
          <li><strong>I3</strong> — operação em massa só com preview de diff.</li>
          <li><strong>I4</strong> — unit_price congelado no envio e imutável depois.</li>
          <li><strong>I6</strong> — CPF mascarado por padrão; revelação auditada.</li>
          <li><strong>I9</strong> — tenant_id obrigatório e filtrado em toda consulta.</li>
          <li><strong>I10</strong> — nenhum segredo no repositório.</li>
          <li><strong>I11</strong> — ação destrutiva exige reason_code de lista fechada.</li>
        </ul>
      </div>
    </main>
  )
}
