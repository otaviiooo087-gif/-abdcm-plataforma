import { config } from 'dotenv'
import postgres from 'postgres'
import { sslParaUrl } from './ssl'

/**
 * Esvazia as tabelas de domínio (TRUNCATE ... CASCADE, que resolve a ordem
 * das FKs sozinho) sem tocar no schema. Útil para rodar a demonstração ou o
 * "npm run test:e2e" repetidas vezes com dados previsíveis — a aplicação em
 * si nunca reseta o banco sozinha, isso é só uma ferramenta de desenvolvimento.
 */
async function main() {
  config({ path: '.env.local' })
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL ausente. Copie .env.example para .env.local e preencha.')

  const sql = postgres(url, { max: 1, ssl: sslParaUrl(url) })
  try {
    console.log('esvaziando tabelas...')
    await sql`
      truncate table
        audit_log, webhook_eventos, notificacoes, pacotes_lote,
        whatsapp_mensagens, whatsapp_conversas, bonus_grants, transactions,
        assinaturas, documentos, contestacoes, process_events, pix_cobrancas,
        registros, submissoes, lotes, associados, parceiros, users, tenants
      cascade
    `
    console.log('ok. rode "npm run db:seed" para repovoar.')
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
