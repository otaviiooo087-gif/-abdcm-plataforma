import { config } from 'dotenv'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import { opcoesDeConexao } from './ssl'

/**
 * Aplica as migrations de src/db/migrations, em ordem, uma por transação
 * (DDL é transacional no Postgres). Idempotente: registra cada arquivo já
 * aplicado numa tabela de controle e pula o que já rodou — é o que permite
 * chamar isto a cada deploy (ver package.json: "build") sem recriar nada.
 */
async function main() {
  config({ path: '.env.local' })
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL ausente. Copie .env.example para .env.local e preencha.')

  const dir = path.join(import.meta.dirname, 'migrations')
  const arquivos = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

  const sql = postgres({ ...opcoesDeConexao(url), max: 1 })
  try {
    await sql`
      create table if not exists _migrations (
        nome_arquivo text primary key,
        aplicada_em  timestamptz not null default now()
      )
    `
    const aplicadas = new Set(
      (await sql`select nome_arquivo from _migrations`).map((r) => r.nome_arquivo as string),
    )

    let pendentes = 0
    for (const arquivo of arquivos) {
      if (aplicadas.has(arquivo)) {
        console.log(`${arquivo}: já aplicada, pulando`)
        continue
      }
      pendentes++
      process.stdout.write(`aplicando ${arquivo}... `)
      const conteudo = readFileSync(path.join(dir, arquivo), 'utf8')
      await sql.begin(async (tx) => {
        await tx.unsafe(conteudo)
        await tx`insert into _migrations (nome_arquivo) values (${arquivo})`
      })
      console.log('ok')
    }
    if (pendentes === 0) console.log('nada a fazer — schema já está em dia.')
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
