/**
 * Schema de Banco de Dados Drizzle ORM — Plataforma ABDCM
 * Conforme Parte 3 da especificação.
 * Invariante I9: tenant_id (uuid, not null) em TODA tabela de domínio.
 * Invariante I2: process_events imutável.
 * Dinheiro sempre em inteiros (centavos).
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. Tenants
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  slug: text('slug').notNull().unique(),
  config: jsonb('config').notNull().default({}),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Users (6 papéis)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  email: text('email').notNull(),
  password_hash: text('password_hash').notNull(),
  role: text('role').notNull(), // parceiro | conciliador | operador | suporte | financeiro | administrador
  is_active: boolean('is_active').notNull().default(true),
  email_verified_at: timestamp('email_verified_at', { withTimezone: true }),
  last_login_at: timestamp('last_login_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_users_tenant_email').on(table.tenant_id, table.email),
  index('idx_users_tenant_role').on(table.tenant_id, table.role),
]);

// 3. Parceiros
export const parceiros = pgTable('parceiros', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  user_id: uuid('user_id').notNull().references(() => users.id),
  nome_completo: text('nome_completo').notNull(),
  nome_exibicao: text('nome_exibicao').notNull(),
  razao_social: text('razao_social'),
  cpf_cnpj: text('cpf_cnpj').notNull(),
  ddd: text('ddd').notNull(),
  whatsapp: text('whatsapp').notNull(),
  cep: text('cep').notNull(),
  rua: text('rua').notNull(),
  numero: text('numero').notNull(),
  cidade: text('cidade').notNull(),
  uf: text('uf').notNull(),
  partner_code: text('partner_code').notNull(),
  indicado_por_parceiro_id: uuid('indicado_por_parceiro_id'),
  preco_por_nome: integer('preco_por_nome'), // centavos, nullable -> herda do lote
  total_nomes_enviados: integer('total_nomes_enviados').notNull().default(0),
  contrato_aceito_em: timestamp('contrato_aceito_em', { withTimezone: true }),
  contrato_versao: text('contrato_versao'),
  assinatura_status: text('assinatura_status').notNull().default('ativo'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_parceiros_tenant_user').on(table.tenant_id, table.user_id),
  index('idx_parceiros_tenant_code').on(table.tenant_id, table.partner_code),
]);

// 4. Associados (Ficha associativa & identidade do bot)
export const associados = pgTable('associados', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  parceiro_id: uuid('parceiro_id').notNull().references(() => parceiros.id),
  nome: text('nome').notNull(),
  cpf_cnpj: text('cpf_cnpj').notNull(), // mascarado
  cpf_cnpj_raw: text('cpf_cnpj_raw').notNull(),
  tipo_documento: text('tipo_documento').notNull(), // cpf | cnpj
  telefone_whatsapp: text('telefone_whatsapp').notNull(),
  email: text('email'),
  status_filiacao: text('status_filiacao').notNull().default('pre_cadastro'),
  filiado_em: timestamp('filiado_em', { withTimezone: true }),
  consentimento_em: timestamp('consentimento_em', { withTimezone: true }),
  consentimento_ip: text('consentimento_ip'),
  consentimento_hash: text('consentimento_hash'),
  ficha_documento_id: uuid('ficha_documento_id'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_associados_tenant_phone').on(table.tenant_id, table.telefone_whatsapp),
  index('idx_associados_tenant_doc_raw').on(table.tenant_id, table.cpf_cnpj_raw),
  index('idx_associados_tenant_parceiro').on(table.tenant_id, table.parceiro_id),
]);

// 5. Lotes (Ações Coletivas)
export const lotes = pgTable('lotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  nome: text('nome').notNull(), // ex: "AÇÃO COLETIVA 124"
  numero_sequencial: integer('numero_sequencial').notNull(),
  status: text('status').notNull().default('aberto'),
  abre_em: timestamp('abre_em', { withTimezone: true }).notNull(),
  closes_at: timestamp('closes_at', { withTimezone: true }).notNull(),
  deadline_time: text('deadline_time').notNull().default('23:59:59'),
  preco_por_nome: integer('preco_por_nome').notNull(), // centavos
  bureaus: text('bureaus').array().notNull(),
  referencia_protocolo: text('referencia_protocolo'),
  concluido_em: timestamp('concluido_em', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_lotes_tenant_status').on(table.tenant_id, table.status),
  index('idx_lotes_tenant_seq').on(table.tenant_id, table.numero_sequencial),
]);

// 6. Submissoes (unidade de cobrança pré-paga)
export const submissoes = pgTable('submissoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  parceiro_id: uuid('parceiro_id').notNull().references(() => parceiros.id),
  lote_id: uuid('lote_id').notNull().references(() => lotes.id),
  nomes_count: integer('nomes_count').notNull(),
  valor_total: integer('valor_total').notNull(), // centavos
  payment_status: text('payment_status').notNull().default('pendente'),
  submetido_em: timestamp('submetido_em', { withTimezone: true }).defaultNow().notNull(),
  confirmado_em: timestamp('confirmado_em', { withTimezone: true }),
  revisado_por_user_id: uuid('revisado_por_user_id').references(() => users.id),
  reason_code: text('reason_code'),
  motivo_observacao: text('motivo_observacao'),
}, (table) => [
  index('idx_submissoes_tenant_parceiro').on(table.tenant_id, table.parceiro_id),
  index('idx_submissoes_tenant_lote').on(table.tenant_id, table.lote_id),
  index('idx_submissoes_tenant_status').on(table.tenant_id, table.payment_status),
]);

// 7. Registros (process_status)
export const registros = pgTable('registros', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  lote_id: uuid('lote_id').notNull().references(() => lotes.id),
  parceiro_id: uuid('parceiro_id').notNull().references(() => parceiros.id),
  associado_id: uuid('associado_id').notNull().references(() => associados.id),
  submissao_id: uuid('submissao_id').references(() => submissoes.id),
  nome: text('nome').notNull(),
  cpf_cnpj: text('cpf_cnpj').notNull(),
  cpf_cnpj_raw: text('cpf_cnpj_raw').notNull(),
  tipo_documento: text('tipo_documento').notNull(),
  process_status: text('process_status').notNull().default('pendente'),
  is_locked: boolean('is_locked').notNull().default(false),
  observacoes_internas: text('observacoes_internas'),
  unit_price: integer('unit_price').notNull(), // centavos congelados
  is_bonus: boolean('is_bonus').notNull().default(false),
  protocol_code: text('protocol_code'),
  reprotocol_of_registro_id: uuid('reprotocol_of_registro_id'),
  origem: text('origem').notNull().default('manual'),
  enviado_em: timestamp('enviado_em', { withTimezone: true }),
  protocolado_em: timestamp('protocolado_em', { withTimezone: true }),
  baixado_em: timestamp('baixado_em', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_registros_tenant_lote').on(table.tenant_id, table.lote_id),
  index('idx_registros_tenant_status').on(table.tenant_id, table.process_status),
  index('idx_registros_tenant_associado').on(table.tenant_id, table.associado_id),
  index('idx_registros_tenant_parceiro').on(table.tenant_id, table.parceiro_id),
]);

// 8. Process Events (IMUTÁVEL - sem update, sem delete)
export const process_events = pgTable('process_events', {
  id: text('id').primaryKey(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  registro_id: uuid('registro_id').notNull().references(() => registros.id),
  de_status: text('de_status'),
  para_status: text('para_status').notNull(),
  ator_tipo: text('ator_tipo').notNull(), // parceiro | admin | system | integracao
  ator_user_id: text('ator_user_id').notNull(),
  motivo: text('motivo').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  ocorrido_em: timestamp('ocorrido_em', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_process_events_tenant_reg').on(table.tenant_id, table.registro_id),
  index('idx_process_events_tenant_time').on(table.tenant_id, table.ocorrido_em),
]);

// 9. PIX Cobranças
export const pix_cobrancas = pgTable('pix_cobrancas', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  submissao_id: uuid('submissao_id').notNull().references(() => submissoes.id),
  provider: text('provider').notNull().default('mock'),
  txid: text('txid').notNull().unique(),
  valor: integer('valor').notNull(), // centavos
  copia_e_cola: text('copia_e_cola').notNull(),
  qrcode_path: text('qrcode_path'),
  expira_em: timestamp('expira_em', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('pendente'),
  pago_em: timestamp('pago_em', { withTimezone: true }),
  payload_webhook: jsonb('payload_webhook'),
}, (table) => [
  index('idx_pix_tenant_submissao').on(table.tenant_id, table.submissao_id),
  index('idx_pix_tenant_txid').on(table.tenant_id, table.txid),
]);

// 10. Documentos
export const documentos = pgTable('documentos', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  owner_type: text('owner_type').notNull(),
  owner_id: text('owner_id').notNull(),
  kind: text('kind').notNull(), // ficha | comprovante_pix | planilha_import | retorno_birô | pacote
  storage_path: text('storage_path').notNull(),
  nome_original: text('nome_original').notNull(),
  mime_type: text('mime_type').notNull(),
  size_bytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  status: text('status').notNull().default('valido'),
  reason_code: text('reason_code'),
  versao: integer('versao').notNull().default(1),
  enviado_por_user_id: text('enviado_por_user_id').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_documentos_tenant_owner').on(table.tenant_id, table.owner_type, table.owner_id),
]);

// 11. Assinaturas
export const assinaturas = pgTable('assinaturas', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  associado_id: uuid('associado_id').notNull().references(() => associados.id),
  provider: text('provider').notNull(),
  envelope_id: text('envelope_id').notNull(),
  status: text('status').notNull().default('enviado'),
  assinado_em: timestamp('assinado_em', { withTimezone: true }),
  documento_id: uuid('documento_id'),
}, (table) => [
  index('idx_assinaturas_tenant_assoc').on(table.tenant_id, table.associado_id),
]);

// 12. Transactions (Ledger)
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  parceiro_id: uuid('parceiro_id').notNull().references(() => parceiros.id),
  tipo: text('tipo').notNull(), // cobranca | pagamento | credito_bonus | ajuste | estorno
  valor: integer('valor').notNull(), // centavos
  saldo_apos: integer('saldo_apos').notNull(),
  referencia_tipo: text('referencia_tipo'),
  referencia_id: text('referencia_id'),
  descricao: text('descricao').notNull(),
  reason_code: text('reason_code'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_trans_tenant_parceiro').on(table.tenant_id, table.parceiro_id),
]);

// 13. Bonus Grants
export const bonus_grants = pgTable('bonus_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  parceiro_id: uuid('parceiro_id').notNull().references(() => parceiros.id),
  meta: integer('meta').notNull(),
  nomes_bonus: integer('nomes_bonus').notNull(),
  nomes_consumidos: integer('nomes_consumidos').notNull().default(0),
  concedido_em: timestamp('concedido_em', { withTimezone: true }).defaultNow().notNull(),
  expira_em: timestamp('expira_em', { withTimezone: true }),
}, (table) => [
  index('idx_bonus_tenant_parceiro').on(table.tenant_id, table.parceiro_id),
]);

// 14. Contestações (SLA 48h, bloqueio 72h)
export const contestacoes = pgTable('contestacoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  parceiro_id: uuid('parceiro_id').notNull().references(() => parceiros.id),
  lote_id: uuid('lote_id').notNull().references(() => lotes.id),
  registro_id: uuid('registro_id').notNull().references(() => registros.id),
  reason_code: text('reason_code').notNull(),
  descricao: text('descricao').notNull(),
  status: text('status').notNull().default('aberta'),
  sla_vence_em: timestamp('sla_vence_em', { withTimezone: true }).notNull(),
  resolvido_em: timestamp('resolvido_em', { withTimezone: true }),
  resolucao: text('resolucao'),
  resolvido_por_user_id: uuid('resolvido_por_user_id').references(() => users.id),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_contest_tenant_status').on(table.tenant_id, table.status),
  index('idx_contest_tenant_sla').on(table.tenant_id, table.sla_vence_em),
]);

// 15. WhatsApp Conversas
export const whatsapp_conversas = pgTable('whatsapp_conversas', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  associado_id: uuid('associado_id').references(() => associados.id),
  parceiro_id: uuid('parceiro_id').references(() => parceiros.id),
  telefone: text('telefone').notNull(),
  janela_aberta_ate: timestamp('janela_aberta_ate', { withTimezone: true }),
  ultima_mensagem_em: timestamp('ultima_mensagem_em', { withTimezone: true }),
}, (table) => [
  index('idx_wpp_tenant_tel').on(table.tenant_id, table.telefone),
]);

// 16. WhatsApp Mensagens
export const whatsapp_mensagens = pgTable('whatsapp_mensagens', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  conversa_id: uuid('conversa_id').notNull().references(() => whatsapp_conversas.id),
  direcao: text('direcao').notNull(), // entrada | saida
  tipo: text('tipo').notNull(), // template | livre
  template_nome: text('template_nome'),
  conteudo: text('conteudo').notNull(),
  ferramentas_chamadas: jsonb('ferramentas_chamadas'),
  status_entrega: text('status_entrega').notNull().default('enviada'),
  wamid: text('wamid').unique(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_wpp_msg_tenant_conv').on(table.tenant_id, table.conversa_id),
]);

// 17. Webhook Eventos (Idempotência obrigatória)
export const webhook_eventos = pgTable('webhook_eventos', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  provider: text('provider').notNull(),
  evento_id: text('evento_id').notNull().unique(),
  payload: jsonb('payload').notNull(),
  processado_em: timestamp('processado_em', { withTimezone: true }),
  erro: text('erro'),
  tentativas: integer('tentativas').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_webhooks_tenant_provider').on(table.tenant_id, table.provider),
]);

// 18. Pacotes Lote
export const pacotes_lote = pgTable('pacotes_lote', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  lote_id: uuid('lote_id').notNull().references(() => lotes.id),
  tipo: text('tipo').notNull(), // envio | retorno
  documento_id: uuid('documento_id').references(() => documentos.id),
  checksum: text('checksum').notNull(),
  registros_count: integer('registros_count').notNull(),
  gerado_por_user_id: text('gerado_por_user_id').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_pacotes_tenant_lote').on(table.tenant_id, table.lote_id),
]);

// 19. Notificações
export const notificacoes = pgTable('notificacoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  destinatario_tipo: text('destinatario_tipo').notNull(), // parceiro | associado | admin
  destinatario_id: text('destinatario_id').notNull(),
  canal: text('canal').notNull(), // in_app | email | whatsapp
  evento_tipo: text('evento_tipo').notNull(),
  template_nome: text('template_nome'),
  titulo: text('titulo').notNull(),
  corpo: text('corpo').notNull(),
  payload: jsonb('payload'),
  lida_em: timestamp('lida_em', { withTimezone: true }),
  enviada_em: timestamp('enviada_em', { withTimezone: true }),
  erro: text('erro'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_notif_tenant_dest').on(table.tenant_id, table.destinatario_id),
]);

// 20. System Config
export const system_config = pgTable('system_config', {
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
  descricao: text('descricao'),
  atualizado_por: text('atualizado_por'),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_sysconf_tenant_key').on(table.tenant_id, table.key),
]);

// 21. Feature Flags
export const feature_flags = pgTable('feature_flags', {
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  key: text('key').notNull(),
  habilitado_global: boolean('habilitado_global').notNull().default(false),
  habilitado_para_roles: text('habilitado_para_roles').array(),
  habilitado_para_parceiros: uuid('habilitado_para_parceiros').array(),
}, (table) => [
  index('idx_ff_tenant_key').on(table.tenant_id, table.key),
]);

// 22. Audit Log (IMUTÁVEL - sem update, sem delete)
export const audit_log = pgTable('audit_log', {
  id: text('id').primaryKey(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  ator_user_id: text('ator_user_id').notNull(),
  acao: text('acao').notNull(),
  entidade_tipo: text('entidade_tipo').notNull(),
  entidade_id: text('entidade_id').notNull(),
  antes: jsonb('antes'),
  depois: jsonb('depois'),
  ip: text('ip').notNull(),
  user_agent: text('user_agent').notNull(),
  ocorrido_em: timestamp('ocorrido_em', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_audit_tenant_entidade').on(table.tenant_id, table.entidade_tipo, table.entidade_id),
  index('idx_audit_tenant_ator').on(table.tenant_id, table.ator_user_id),
]);
