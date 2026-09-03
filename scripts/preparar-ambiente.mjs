/**
 * Cria .env.local a partir de .env.example, gerando um SESSION_SECRET aleatório.
 * O arquivo é ignorado pelo git — nenhum segredo entra no repositório (I10).
 */
import { randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

const destino = '.env.local'

if (existsSync(destino)) {
  console.log('.env.local já existe — nada a fazer.')
  process.exit(0)
}

copyFileSync('.env.example', destino)
const conteudo = readFileSync(destino, 'utf8').replace(
  /^SESSION_SECRET=.*$/m,
  `SESSION_SECRET=${randomBytes(32).toString('hex')}`,
)
writeFileSync(destino, conteudo)
console.log('.env.local criado com SESSION_SECRET gerado localmente.')
