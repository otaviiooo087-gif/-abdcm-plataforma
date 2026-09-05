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

/** Conexão Postgres via postgres.js, com um único cliente reutilizado no processo. */
const g = globalThis as { __abdcmSql?: postgres.Sql }
function conexao(): postgres.Sql {
  g.__abdcmSql ??= postgres({ ...opcoesDeConexao(url()), prepare: false, max: 5, idle_timeout: 20 })
  return g.__abdcmSql
}

export function db() {
  return drizzle(conexao(), { schema })
}
