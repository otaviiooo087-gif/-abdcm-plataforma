/**
 * Postgres gerenciado (Railway, Supabase, Vercel Postgres) exige conexão
 * criptografada no endpoint público, geralmente com certificado autoassinado
 * — por isso `rejectUnauthorized: false` em vez de `ssl: 'require'` puro.
 * Local (`localhost`/`127.0.0.1`) continua sem SSL, como já era.
 */
export function sslParaUrl(url: string): false | { rejectUnauthorized: false } {
  const host = new URL(url).hostname
  return host === 'localhost' || host === '127.0.0.1' ? false : { rejectUnauthorized: false }
}
