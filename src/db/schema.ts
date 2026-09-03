/**
 * Schema Drizzle — mapeia exatamente as tabelas de src/db/migrations/0001_schema_inicial.sql
 * que a aplicação já consome. As demais tabelas da migration (documentos,
 * assinaturas, transactions, bonus_grants, whatsapp_*, webhook_eventos,
 * pacotes_lote, notificacoes, system_config, feature_flags) existem no
 * banco desde a Fase 0, mas só ganham mapeamento aqui quando alguma fase
 * futura passar a consultá-las.
 */
import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const roleUsuario = pgEnum('role_usuario', [
  'parceiro', 'conciliador', 'operador', 'suporte', 'financeiro', 'administrador',
])
export const processStatusEnum = pgEnum('process_status', [
  'pendente', 'enviado', 'aguardando_pagamento', 'pago', 'reprovado',
  'aguardando_protocolo', 'protocolado', 'baixado', 'recusado', 'cancelado',
])
export const statusLoteEnum = pgEnum('status_lote', [
  'rascunho', 'aberto', 'encerrado', 'em_protocolo', 'protocolado', 'concluido',
])
export const statusFiliacaoEnum = pgEnum('status_filiacao', [
  'pre_cadastro', 'ficha_enviada', 'ficha_assinada', 'ativo', 'inativo',
])
export const statusPagamentoEnum = pgEnum('status_pagamento', [
  'pendente', 'pago', 'expirado', 'reprovado', 'cancelado',
])
export const tipoDocumentoEnum = pgEnum('tipo_documento', ['cpf', 'cnpj'])
export const atorTipoEnum = pgEnum('ator_tipo', ['parceiro', 'admin', 'system', 'integracao'])
export const origemRegistroEnum = pgEnum('origem_registro', ['manual', 'planilha', 'reprotocolo', 'bonus'])

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  slug: text('slug').notNull(),
  config: jsonb('config').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash'),
  role: roleUsuario('role').notNull(),
  nome: text('nome').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const parceiros = pgTable('parceiros', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  userId: uuid('user_id').notNull(),
  nomeCompleto: text('nome_completo').notNull(),
  nomeExibicao: text('nome_exibicao').notNull(),
  cpfCnpj: text('cpf_cnpj').notNull(),
  whatsapp: text('whatsapp'),
  cidade: text('cidade'),
  uf: text('uf'),
  partnerCode: text('partner_code').notNull(),
  precoPorNome: bigint('preco_por_nome', { mode: 'number' }),
  totalNomesEnviados: integer('total_nomes_enviados').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
})

export const associados = pgTable('associados', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  parceiroId: uuid('parceiro_id').notNull(),
  nome: text('nome').notNull(),
  cpfCnpj: text('cpf_cnpj').notNull(),
  cpfCnpjRaw: text('cpf_cnpj_raw').notNull(),
  tipoDocumento: tipoDocumentoEnum('tipo_documento').notNull(),
  telefoneWhatsapp: text('telefone_whatsapp').notNull(),
  email: text('email'),
  statusFiliacao: statusFiliacaoEnum('status_filiacao').notNull().default('pre_cadastro'),
  filiadoEm: timestamp('filiado_em', { withTimezone: true }),
  consentimentoEm: timestamp('consentimento_em', { withTimezone: true }),
  consentimentoIp: text('consentimento_ip'),
  consentimentoHash: text('consentimento_hash'),
})

export const lotes = pgTable('lotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  nome: text('nome').notNull(),
  numeroSequencial: integer('numero_sequencial').notNull(),
  status: statusLoteEnum('status').notNull().default('rascunho'),
  abreEm: timestamp('abre_em', { withTimezone: true }).notNull(),
  closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
  precoPorNome: bigint('preco_por_nome', { mode: 'number' }).notNull(),
  bureaus: text('bureaus').array().notNull().default([]),
  referenciaProtocolo: text('referencia_protocolo'),
  concluidoEm: timestamp('concluido_em', { withTimezone: true }),
})

export const submissoes = pgTable('submissoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  parceiroId: uuid('parceiro_id').notNull(),
  loteId: uuid('lote_id').notNull(),
  nomesCount: integer('nomes_count').notNull(),
  valorTotal: bigint('valor_total', { mode: 'number' }).notNull(),
  paymentStatus: statusPagamentoEnum('payment_status').notNull().default('pendente'),
  submetidoEm: timestamp('submetido_em', { withTimezone: true }).notNull().defaultNow(),
  confirmadoEm: timestamp('confirmado_em', { withTimezone: true }),
  reasonCode: text('reason_code'),
  motivoObservacao: text('motivo_observacao'),
  motivoExcecao: text('motivo_excecao'),
  valorIdentificado: bigint('valor_identificado', { mode: 'number' }),
  comprovanteManual: boolean('comprovante_manual').notNull().default(false),
})

export const registros = pgTable('registros', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  loteId: uuid('lote_id').notNull(),
  parceiroId: uuid('parceiro_id').notNull(),
  associadoId: uuid('associado_id').notNull(),
  submissaoId: uuid('submissao_id'),
  nome: text('nome').notNull(),
  cpfCnpj: text('cpf_cnpj').notNull(),
  cpfCnpjRaw: text('cpf_cnpj_raw').notNull(),
  tipoDocumento: tipoDocumentoEnum('tipo_documento').notNull(),
  processStatus: processStatusEnum('process_status').notNull().default('pendente'),
  isLocked: boolean('is_locked').notNull().default(false),
  unitPrice: bigint('unit_price', { mode: 'number' }).notNull(),
  isBonus: boolean('is_bonus').notNull().default(false),
  protocolCode: text('protocol_code'),
  reprotocolOfRegistroId: uuid('reprotocol_of_registro_id'),
  origem: origemRegistroEnum('origem').notNull().default('manual'),
  enviadoEm: timestamp('enviado_em', { withTimezone: true }),
  protocoladoEm: timestamp('protocolado_em', { withTimezone: true }),
  baixadoEm: timestamp('baixado_em', { withTimezone: true }),
})

export const pixCobrancas = pgTable('pix_cobrancas', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  submissaoId: uuid('submissao_id').notNull(),
  provider: text('provider').notNull(),
  txid: text('txid').notNull(),
  valor: bigint('valor', { mode: 'number' }).notNull(),
  copiaECola: text('copia_e_cola').notNull(),
  expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
  status: statusPagamentoEnum('status').notNull().default('pendente'),
  pagoEm: timestamp('pago_em', { withTimezone: true }),
})

export const processEvents = pgTable('process_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  registroId: uuid('registro_id').notNull(),
  deStatus: processStatusEnum('de_status').notNull(),
  paraStatus: processStatusEnum('para_status').notNull(),
  atorTipo: atorTipoEnum('ator_tipo').notNull(),
  atorUserId: uuid('ator_user_id'),
  transicao: text('transicao').notNull(),
  motivo: text('motivo'),
  reasonCode: text('reason_code'),
  metadata: jsonb('metadata').notNull().default({}),
  ocorridoEm: timestamp('ocorrido_em', { withTimezone: true }).notNull().defaultNow(),
})

export const contestacoes = pgTable('contestacoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  parceiroId: uuid('parceiro_id').notNull(),
  loteId: uuid('lote_id').notNull(),
  registroId: uuid('registro_id').notNull(),
  reasonCode: text('reason_code').notNull(),
  descricao: text('descricao').notNull(),
  status: text('status').notNull().default('aberta'),
  abertaEm: timestamp('aberta_em', { withTimezone: true }).notNull().defaultNow(),
  slaVenceEm: timestamp('sla_vence_em', { withTimezone: true }).notNull(),
  resolvidoEm: timestamp('resolvido_em', { withTimezone: true }),
})

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  atorUserId: uuid('ator_user_id'),
  acao: text('acao').notNull(),
  entidadeTipo: text('entidade_tipo').notNull(),
  entidadeId: uuid('entidade_id'),
  antes: jsonb('antes'),
  depois: jsonb('depois'),
  ip: text('ip'),
  ocorridoEm: timestamp('ocorrido_em', { withTimezone: true }).notNull().defaultNow(),
})
