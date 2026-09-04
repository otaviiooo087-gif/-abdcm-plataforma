import 'server-only'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'
import { opcoesDeConexao } from './ssl'

function url(): string {
  const u = process.env.DATABASE_URL
  if (!u) {
    throw new Error(
      'DATABASE_URL ausente. Defina no .env.local (Postgres local) ou nas variáveis de ambiente ' +
        'de produção (invariante I10 — nenhum segredo no repositório).',
    )
  }
  return u
}

/**
 * Conexão Postgres via postgres.js. `prepare: false` e um teto baixo de
 * conexões porque cada instância de função serverless (Vercel) abre a sua —
 * o correto em produção é apontar DATABASE_URL para o pooler do provedor
 * (Supabase: porta 6543; Neon/Vercel Postgres: connection string já vem
 * com pooling).
 */
const g = globalThis as { __abdcmSql?: postgres.Sql }
function conexao(): postgres.Sql {
  g.__abdcmSql ??= postgres({ ...opcoesDeConexao(url()), prepare: false, max: 5, idle_timeout: 20 })
  return g.__abdcmSql
}

export function db() {
  return drizzle(conexao(), { schema })
}
