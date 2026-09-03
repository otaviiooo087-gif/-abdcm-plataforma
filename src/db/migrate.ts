import { config } from 'dotenv'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'

/**
 * Aplica as migrations de src/db/migrations, em ordem, dentro de uma
 * transação por arquivo. Cada arquivo é enviado como um único statement
 * multi-comando (protocolo simples), o que preserva os blocos `$$...$$`
 * das funções de trigger.
 */
async function main() {
  config({ path: '.env.local' })
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL ausente. Copie .env.example para .env.local e preencha.')

  const dir = path.join(import.meta.dirname, 'migrations')
  const arquivos = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

  const sql = postgres(url, { max: 1 })
  try {
    for (const arquivo of arquivos) {
      process.stdout.write(`aplicando ${arquivo}... `)
      const conteudo = readFileSync(path.join(dir, arquivo), 'utf8')
      await sql.unsafe(conteudo)
      console.log('ok')
    }
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
