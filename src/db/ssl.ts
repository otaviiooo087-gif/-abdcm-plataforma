/**
 * Opções de conexão do postgres.js, montadas a partir de DATABASE_URL com o
 * parser nativo `URL` em vez de passar a string direto pro postgres.js.
 *
 * O parser interno do postgres.js (parseUrl, em node_modules/postgres) faz
 * fatiamento manual de string (`indexOf('@')`, `indexOf('://')`) em vez de
 * usar o `URL` do próprio Node — qualquer caractere especial não percent-
 * encoded na senha (comum em senha gerada por provedor gerenciado, tipo
 * Railway) quebra esse parsing com "TypeError: Invalid URL". Resolvendo a
 * URL aqui e entregando um objeto de opções — não mais a string — esse
 * parser problemático nunca roda (postgres.js só invoca `parseUrl` quando o
 * primeiro argumento é string; ver `parseOptions` na lib).
 *
 * Postgres gerenciado (Railway, Supabase, Vercel Postgres) exige conexão
 * criptografada no endpoint público, geralmente com certificado autoassinado
 * — por isso `rejectUnauthorized: false` em vez de `ssl: 'require'` puro.
 * Local (`localhost`/`127.0.0.1`) continua sem SSL, como já era.
 */
export function opcoesDeConexao(databaseUrl: string) {
  const bruta = databaseUrl.trim()
  if (!/^postgres(ql)?:\/\//.test(bruta)) {
    throw new Error(
      'DATABASE_URL não parece uma connection string do Postgres (deveria começar com ' +
        '"postgresql://" ou "postgres://"). Confira se o valor colado não inclui o nome da ' +
        'variável (ex.: "DATABASE_PUBLIC_URL=...") nem aspas ao redor — cole só a URL crua.',
    )
  }
  const u = new URL(bruta)
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    database: u.pathname.replace(/^\//, ''),
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl: (local ? false : { rejectUnauthorized: false }) as false | { rejectUnauthorized: false },
  }
}
