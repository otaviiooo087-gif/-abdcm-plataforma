import { config } from 'dotenv'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { opcoesDeConexao } from './ssl'
import * as schema from './schema'
import {
  SEED_LOTES,
  SEED_ASSOCIADOS,
  SEED_REGISTROS,
  SEED_PROCESS_EVENTS,
  SEED_AUDIT_LOG,
  SEED_SUBMISSOES,
} from '../mockData'

/**
 * Popula o banco com os mesmos dados de demonstração que o mockDb usava em
 * memória. Roda uma vez, contra um banco vazio (migrations já aplicadas) —
 * não é idempotente por design: rodar duas vezes duplica os dados (mesma
 * chave primária faria a inserção falhar, o que é o comportamento certo:
 * evita popular duas vezes sem querer).
 */
async function main() {
  config({ path: '.env.local' })
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL ausente. Copie .env.example para .env.local e preencha.')

  const sql = postgres({ ...opcoesDeConexao(url), max: 1 })
  const db = drizzle(sql, { schema })

  try {
    console.log('semeando lotes...')
    await db.insert(schema.lotes).values(
      SEED_LOTES.map((l) => ({
        id: l.id,
        tenantId: l.tenant_id,
        nome: l.nome,
        codigo: l.codigo ?? null,
        numeroSequencial: l.numero_sequencial,
        status: l.status,
        abreEm: l.abre_em,
        closesAt: l.closes_at,
        deadlineTime: l.deadline_time,
        precoPorNome: l.preco_por_nome,
        bureaus: l.bureaus,
        referenciaProtocolo: l.referencia_protocolo ?? null,
        numeroProcesso: l.numero_processo ?? null,
        varaTribunal: l.vara_tribunal ?? null,
        juiz: l.juiz ?? null,
        dataProtocolo: l.data_protocolo ?? null,
        dataDistribuicao: l.data_distribuicao ?? null,
        liminarStatus: l.liminar_status ?? null,
        concluidoEm: l.concluido_em ?? null,
        createdAt: l.created_at,
      })),
    )

    console.log('semeando associados...')
    await db.insert(schema.associados).values(
      SEED_ASSOCIADOS.map((a) => ({
        id: a.id,
        tenantId: a.tenant_id,
        parceiroId: a.parceiro_id,
        nome: a.nome,
        cpfCnpjRaw: a.cpf_cnpj_raw,
        cpfCnpj: a.cpf_cnpj,
        tipoDocumento: a.tipo_documento,
        telefoneWhatsapp: a.telefone_whatsapp,
        email: a.email ?? null,
        statusFiliacao: a.status_filiacao,
        filiadoEm: a.filiado_em ?? null,
        consentimentoEm: a.consentimento_em ?? null,
        consentimentoIp: a.consentimento_ip ?? null,
        consentimentoHash: a.consentimento_hash ?? null,
        fichaDocumentoId: a.ficha_documento_id ?? null,
        createdAt: a.created_at,
      })),
    )

    console.log('semeando registros...')
    await db.insert(schema.registros).values(
      SEED_REGISTROS.map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        loteId: r.lote_id,
        parceiroId: r.parceiro_id,
        associadoId: r.associado_id,
        submissaoId: r.submissao_id ?? null,
        nome: r.nome,
        cpfCnpjRaw: r.cpf_cnpj_raw,
        cpfCnpj: r.cpf_cnpj,
        tipoDocumento: r.tipo_documento,
        processStatus: r.process_status,
        isLocked: r.is_locked,
        observacoesInternas: r.observacoes_internas ?? null,
        unitPrice: r.unit_price,
        isBonus: r.is_bonus,
        protocolCode: r.protocol_code ?? null,
        reprotocolOfRegistroId: r.reprotocol_of_registro_id ?? null,
        origem: r.origem,
        enviadoEm: r.enviado_em ?? null,
        protocoladoEm: r.protocolado_em ?? null,
        baixadoEm: r.baixado_em ?? null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    )

    console.log('semeando submissões...')
    await db.insert(schema.submissoes).values(
      SEED_SUBMISSOES.map((s) => ({
        id: s.id,
        tenantId: s.tenant_id,
        parceiroId: s.parceiro_id,
        loteId: s.lote_id,
        nomesCount: s.nomes_count,
        valorTotal: s.valor_total,
        paymentStatus: s.payment_status,
        submetidoEm: s.submetido_em,
        confirmadoEm: s.confirmado_em ?? null,
        revisadoPorUserId: s.revisado_por_user_id ?? null,
        reasonCode: s.reason_code ?? null,
        motivoObservacao: s.motivo_observacao ?? null,
      })),
    )

    console.log('semeando eventos de processo...')
    await db.insert(schema.processEvents).values(
      SEED_PROCESS_EVENTS.map((e) => ({
        id: e.id,
        tenantId: e.tenant_id,
        registroId: e.registro_id,
        deStatus: e.de_status ?? null,
        paraStatus: e.para_status,
        atorTipo: e.ator_tipo,
        atorUserId: e.ator_user_id,
        motivo: e.motivo,
        metadata: e.metadata ?? null,
        ocorridoEm: e.ocorrido_em,
      })),
    )

    console.log('semeando auditoria...')
    await db.insert(schema.auditLog).values(
      SEED_AUDIT_LOG.map((a) => ({
        id: a.id,
        tenantId: a.tenant_id,
        atorUserId: a.ator_user_id,
        acao: a.acao,
        entidadeTipo: a.entidade_tipo,
        entidadeId: a.entidade_id ?? null,
        antes: a.antes ?? null,
        depois: a.depois ?? null,
        ip: a.ip ?? null,
        userAgent: a.user_agent ?? null,
        ocorridoEm: a.ocorrido_em,
      })),
    )

    console.log('\npronto.')
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
