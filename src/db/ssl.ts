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
/**
 * Isola se a URL inválida quebra por causa das credenciais (usuário/senha —
 * que não podemos imprimir, é segredo) ou do host/porta/banco (que não é
 * segredo — nomes de host e banco já aparecem normalmente em qualquer
 * console de provedor gerenciado). Reconstrói a URL trocando só a parte de
 * credenciais por um valor neutro: se isso já resolve, o problema está na
 * senha (típico: "@" ou "#" sem percent-encoding); se continua quebrando,
 * o problema está depois do "@", que é seguro revelar.
 */
function diagnosticoUrlInvalida(bruta: string): string {
  const semEsquema = bruta.slice(bruta.indexOf('://') + 3)
  const antesDoPath = semEsquema.split(/[/?]/)[0]!
  const arrobaIdx = antesDoPath.lastIndexOf('@')
  if (arrobaIdx === -1) {
    return 'DATABASE_URL não tem "@" separando credenciais do host — formato incompleto (esperado "postgresql://usuario:senha@host:porta/banco").'
  }

  const credenciais = antesDoPath.slice(0, arrobaIdx)
  const depoisDoArroba = semEsquema.slice(arrobaIdx + 1)
  const [usuario = '', ...resto] = credenciais.split(':')
  const senha = resto.join(':')

  let hostSozinhoOk = true
  try {
    new URL(`postgresql://x:y@${depoisDoArroba}`)
  } catch {
    hostSozinhoOk = false
  }

  if (hostSozinhoOk) {
    return (
      `DATABASE_URL não é uma URL válida, mas host/porta/banco sozinhos parseiam bem — o ` +
      `problema está nas credenciais (usuário: ${usuario.length} caractere(s), senha: ` +
      `${senha.length} caractere(s)). Causa mais provável: a senha tem "@", "#", espaço ou "/" ` +
      `sem percent-encoding. Troque na origem: "@"→"%40", "#"→"%23", "/"→"%2F", espaço→"%20".`
    )
  }

  return (
    `DATABASE_URL não é uma URL válida, e o problema está depois do "@" — não é credencial, ` +
    `então dá pra mostrar: "${depoisDoArroba}". Confira porta numérica válida e host sem ` +
    `espaço/caractere especial.`
  )
}

export function opcoesDeConexao(databaseUrl: string) {
  const bruta = databaseUrl.trim()
  if (!/^postgres(ql)?:\/\//.test(bruta)) {
    throw new Error(
      'DATABASE_URL não parece uma connection string do Postgres (deveria começar com ' +
        '"postgresql://" ou "postgres://"). Confira se o valor colado não inclui o nome da ' +
        'variável (ex.: "DATABASE_PUBLIC_URL=...") nem aspas ao redor — cole só a URL crua.',
    )
  }
  let u: URL
  try {
    u = new URL(bruta)
  } catch {
    throw new Error(diagnosticoUrlInvalida(bruta))
  }
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
