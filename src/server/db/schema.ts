import { boolean, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Schema Postgres via Drizzle, espelhando 1:1 os tipos de src/domain/types.ts
 * (mesmos nomes de campo, snake_case) — para que a troca do mockDb em
 * memória por consultas reais não exija remapear nada na camada acima.
 *
 * tenant_id em toda tabela de domínio (invariante I9), mesmo sem multi-tenant
 * ativo hoje — é preparação para white-label, não feature de hoje.
 */

export const lotes = pgTable('lotes', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  nome: text('nome').notNull(),
  codigo: text('codigo'),
  numeroSequencial: integer('numero_sequencial').notNull(),
  status: text('status').notNull(),
  abreEm: timestamp('abre_em', { withTimezone: true, mode: 'string' }).notNull(),
  closesAt: timestamp('closes_at', { withTimezone: true, mode: 'string' }).notNull(),
  deadlineTime: text('deadline_time').notNull(),
  precoPorNome: integer('preco_por_nome').notNull(),
  bureaus: text('bureaus').array().notNull(),
  referenciaProtocolo: text('referencia_protocolo'),
  numeroProcesso: text('numero_processo'),
  varaTribunal: text('vara_tribunal'),
  juiz: text('juiz'),
  dataProtocolo: timestamp('data_protocolo', { withTimezone: true, mode: 'string' }),
  dataDistribuicao: text('data_distribuicao'),
  liminarStatus: text('liminar_status'),
  concluidoEm: timestamp('concluido_em', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
})

export const associados = pgTable('associados', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  parceiroId: text('parceiro_id').notNull(),
  nome: text('nome').notNull(),
  cpfCnpjRaw: text('cpf_cnpj_raw').notNull(),
  cpfCnpj: text('cpf_cnpj').notNull(),
  tipoDocumento: text('tipo_documento').notNull(),
  telefoneWhatsapp: text('telefone_whatsapp').notNull(),
  email: text('email'),
  statusFiliacao: text('status_filiacao').notNull(),
  filiadoEm: timestamp('filiado_em', { withTimezone: true, mode: 'string' }),
  consentimentoEm: timestamp('consentimento_em', { withTimezone: true, mode: 'string' }),
  consentimentoIp: text('consentimento_ip'),
  consentimentoHash: text('consentimento_hash'),
  fichaDocumentoId: text('ficha_documento_id'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
})

export const registros = pgTable('registros', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  loteId: text('lote_id').notNull(),
  parceiroId: text('parceiro_id').notNull(),
  associadoId: text('associado_id').notNull(),
  submissaoId: text('submissao_id'),
  nome: text('nome').notNull(),
  cpfCnpjRaw: text('cpf_cnpj_raw').notNull(),
  cpfCnpj: text('cpf_cnpj').notNull(),
  tipoDocumento: text('tipo_documento').notNull(),
  processStatus: text('process_status').notNull(),
  isLocked: boolean('is_locked').notNull().default(false),
  observacoesInternas: text('observacoes_internas'),
  unitPrice: integer('unit_price').notNull(),
  isBonus: boolean('is_bonus').notNull().default(false),
  protocolCode: text('protocol_code'),
  reprotocolOfRegistroId: text('reprotocol_of_registro_id'),
  origem: text('origem').notNull(),
  enviadoEm: timestamp('enviado_em', { withTimezone: true, mode: 'string' }),
  protocoladoEm: timestamp('protocolado_em', { withTimezone: true, mode: 'string' }),
  baixadoEm: timestamp('baixado_em', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
})

export const submissoes = pgTable('submissoes', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  parceiroId: text('parceiro_id').notNull(),
  loteId: text('lote_id').notNull(),
  nomesCount: integer('nomes_count').notNull(),
  valorTotal: integer('valor_total').notNull(),
  paymentStatus: text('payment_status').notNull(),
  submetidoEm: timestamp('submetido_em', { withTimezone: true, mode: 'string' }).notNull(),
  confirmadoEm: timestamp('confirmado_em', { withTimezone: true, mode: 'string' }),
  revisadoPorUserId: text('revisado_por_user_id'),
  reasonCode: text('reason_code'),
  motivoObservacao: text('motivo_observacao'),
})

export const processEvents = pgTable('process_events', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  registroId: text('registro_id').notNull(),
  deStatus: text('de_status'),
  paraStatus: text('para_status').notNull(),
  atorTipo: text('ator_tipo').notNull(),
  atorUserId: text('ator_user_id').notNull(),
  motivo: text('motivo').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  ocorridoEm: timestamp('ocorrido_em', { withTimezone: true, mode: 'string' }).notNull(),
})

export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  atorUserId: text('ator_user_id').notNull(),
  acao: text('acao').notNull(),
  entidadeTipo: text('entidade_tipo').notNull(),
  entidadeId: text('entidade_id'),
  antes: jsonb('antes').$type<Record<string, unknown>>(),
  depois: jsonb('depois').$type<Record<string, unknown>>(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  ocorridoEm: timestamp('ocorrido_em', { withTimezone: true, mode: 'string' }).notNull(),
})
