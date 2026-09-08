import { config } from 'dotenv'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import { opcoesDeConexao } from './ssl'
import * as schema from './schema'
import { ABDCM_TENANT_ID } from '../mockData'
import { hashPassword } from '../auth/password'

/**
 * Cria (ou reseta a senha de) uma conta de login real, a qualquer momento —
 * diferente do seed.ts, é seguro rodar quantas vezes precisar.
 *
 * Uso:
 *   npm run db:criar-conta -- --role=parceiro --nome="Fulano LTDA" --email=fulano@exemplo.com --senha=SENHA_FORTE
 *   npm run db:criar-conta -- --role=administrador --nome="Ciclano" --email=ciclano@abdcm.org.br --senha=SENHA_FORTE
 */
function lerArg(nome: string): string | undefined {
  const prefixo = `--${nome}=`
  const achado = process.argv.find((a) => a.startsWith(prefixo))
  return achado?.slice(prefixo.length)
}

async function main() {
  config({ path: '.env.local' })
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL ausente. Copie .env.example para .env.local e preencha.')

  const role = lerArg('role')
  const nome = lerArg('nome')
  const email = lerArg('email')?.trim().toLowerCase()
  const senha = lerArg('senha')

  if (role !== 'parceiro' && role !== 'administrador') {
    throw new Error('--role precisa ser "parceiro" ou "administrador".')
  }
  if (!nome || !email || !senha) {
    throw new Error('Uso: npm run db:criar-conta -- --role=parceiro|administrador --nome=... --email=... --senha=...')
  }
  if (senha.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.')

  const sql = postgres({ ...opcoesDeConexao(url), max: 1 })
  const db = drizzle(sql, { schema })

  try {
    const existentes = await db.select().from(schema.usuarios).where(eq(schema.usuarios.tenantId, ABDCM_TENANT_ID))
    const existente = existentes.find((u) => u.email.toLowerCase() === email)

    const senhaHash = hashPassword(senha)

    if (existente) {
      await db.update(schema.usuarios).set({ senhaHash, nome, ativo: true }).where(eq(schema.usuarios.id, existente.id))
      console.log(`Conta existente atualizada: ${email} (${role})`)
      return
    }

    const id = `usr-${role}-${Date.now()}`
    await db.insert(schema.usuarios).values({
      id,
      tenantId: ABDCM_TENANT_ID,
      nome,
      email,
      senhaHash,
      role,
      parceiroId: role === 'parceiro' ? `parc-${Date.now()}` : null,
      partnerCode: role === 'parceiro' ? `PARC-${id.slice(-8).toUpperCase()}` : null,
      ativo: true,
      createdAt: new Date().toISOString(),
    })
    console.log(`Conta criada: ${email} (${role})`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
