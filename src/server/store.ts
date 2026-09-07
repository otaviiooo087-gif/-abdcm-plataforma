/**
 * Camada de acesso a dados server-side, agora com persistência real em
 * Postgres (era em memória — ver histórico do arquivo mockDb.ts). Mesma
 * API pública que o server.ts já consumia (métodos com os mesmos nomes),
 * só que assíncrona: toda rota que chama `serverStore` precisa de `await`.
 *
 * Respeita I1 (regras no servidor), I2 (ProcessEvent obrigatório em toda
 * transição), I6 (mascaramento — revelação só sob clique, com auditoria),
 * I9 (tenant_id em toda tabela).
 */

import { and, desc, eq, inArray } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { db } from './db/client.js';
import * as schema from './db/schema.js';
import { transitionProcessStatus } from '../domain/registros/stateMachine.js';
import type {
  Lote,
  Registro,
  Associado,
  Submissao,
  ProcessEvent,
  AuditLog,
  ProcessStatus,
  UserRole,
  Contestacao,
  Servico,
  Contrato,
  PixCobranca,
  NotificacaoEnviada,
  AutomacaoConfig,
  TipoNotificacao,
} from '../domain/types.js';
import { ABDCM_TENANT_ID, SEED_USERS, type UserSession } from './mockData.js';
import { maskDocument } from '../lib/masking/documentMasker.js';
import { getPixProvider, pixProviderConfigurado } from '../integrations/pix/index.js';
import { getStorageProvider, storageProviderConfigurado } from '../integrations/storage/index.js';
import { getWhatsAppProvider, whatsAppProviderConfigurado } from '../integrations/whatsapp/index.js';

export { ABDCM_TENANT_ID } from './mockData.js';
export type { UserSession } from './mockData.js';

// ---------------------------------------------------------------------
// Mapeamento linha do banco (camelCase do Drizzle) -> tipos de domínio
// (snake_case, os mesmos que o front-end já consome).
// ---------------------------------------------------------------------

type LoteRow = typeof schema.lotes.$inferSelect;
type AssociadoRow = typeof schema.associados.$inferSelect;
type RegistroRow = typeof schema.registros.$inferSelect;
type SubmissaoRow = typeof schema.submissoes.$inferSelect;
type ProcessEventRow = typeof schema.processEvents.$inferSelect;
type AuditLogRow = typeof schema.auditLog.$inferSelect;
type ContestacaoRow = typeof schema.contestacoes.$inferSelect;
type ServicoRow = typeof schema.servicos.$inferSelect;
type ContratoRow = typeof schema.contratos.$inferSelect;
type PixCobrancaRow = typeof schema.pixCobrancas.$inferSelect;
type NotificacaoEnviadaRow = typeof schema.notificacoesEnviadas.$inferSelect;
type AutomacaoConfigRow = typeof schema.automacoesConfig.$inferSelect;
type DocumentoAssociadoRow = typeof schema.documentosAssociado.$inferSelect;

function loteDeLinha(l: LoteRow): Lote {
  return {
    id: l.id,
    tenant_id: l.tenantId,
    nome: l.nome,
    codigo: l.codigo ?? undefined,
    numero_sequencial: l.numeroSequencial,
    status: l.status as Lote['status'],
    abre_em: l.abreEm,
    closes_at: l.closesAt,
    deadline_time: l.deadlineTime,
    preco_por_nome: l.precoPorNome,
    bureaus: l.bureaus,
    referencia_protocolo: l.referenciaProtocolo,
    numero_processo: l.numeroProcesso,
    vara_tribunal: l.varaTribunal,
    juiz: l.juiz,
    data_protocolo: l.dataProtocolo,
    data_distribuicao: l.dataDistribuicao,
    liminar_status: l.liminarStatus,
    concluido_em: l.concluidoEm,
    created_at: l.createdAt,
  };
}

function associadoDeLinha(a: AssociadoRow): Associado {
  return {
    id: a.id,
    tenant_id: a.tenantId,
    parceiro_id: a.parceiroId,
    nome: a.nome,
    cpf_cnpj_raw: a.cpfCnpjRaw,
    cpf_cnpj: a.cpfCnpj,
    tipo_documento: a.tipoDocumento as Associado['tipo_documento'],
    telefone_whatsapp: a.telefoneWhatsapp,
    email: a.email,
    status_filiacao: a.statusFiliacao as Associado['status_filiacao'],
    filiado_em: a.filiadoEm,
    consentimento_em: a.consentimentoEm,
    consentimento_ip: a.consentimentoIp,
    consentimento_hash: a.consentimentoHash,
    ficha_documento_id: a.fichaDocumentoId,
    created_at: a.createdAt,
  };
}

function registroDeLinha(r: RegistroRow): Registro {
  return {
    id: r.id,
    tenant_id: r.tenantId,
    lote_id: r.loteId,
    parceiro_id: r.parceiroId,
    associado_id: r.associadoId,
    submissao_id: r.submissaoId,
    nome: r.nome,
    cpf_cnpj_raw: r.cpfCnpjRaw,
    cpf_cnpj: r.cpfCnpj,
    tipo_documento: r.tipoDocumento as Registro['tipo_documento'],
    process_status: r.processStatus as ProcessStatus,
    is_locked: r.isLocked,
    observacoes_internas: r.observacoesInternas,
    unit_price: r.unitPrice,
    is_bonus: r.isBonus,
    protocol_code: r.protocolCode,
    reprotocol_of_registro_id: r.reprotocolOfRegistroId,
    origem: r.origem as Registro['origem'],
    enviado_em: r.enviadoEm,
    protocolado_em: r.protocoladoEm,
    baixado_em: r.baixadoEm,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

function submissaoDeLinha(s: SubmissaoRow): Submissao {
  return {
    id: s.id,
    tenant_id: s.tenantId,
    parceiro_id: s.parceiroId,
    lote_id: s.loteId,
    nomes_count: s.nomesCount,
    valor_total: s.valorTotal,
    payment_status: s.paymentStatus as Submissao['payment_status'],
    submetido_em: s.submetidoEm,
    confirmado_em: s.confirmadoEm,
    revisado_por_user_id: s.revisadoPorUserId,
    reason_code: s.reasonCode,
    motivo_observacao: s.motivoObservacao,
    tem_comprovante: Boolean(s.comprovanteBase64),
  };
}

function eventoDeLinha(e: ProcessEventRow): ProcessEvent {
  return {
    id: e.id,
    tenant_id: e.tenantId,
    registro_id: e.registroId,
    de_status: e.deStatus as ProcessStatus | null,
    para_status: e.paraStatus as ProcessStatus,
    ator_tipo: e.atorTipo as ProcessEvent['ator_tipo'],
    ator_user_id: e.atorUserId,
    motivo: e.motivo,
    metadata: e.metadata ?? undefined,
    ocorrido_em: e.ocorridoEm,
  };
}

function auditoriaDeLinha(a: AuditLogRow): AuditLog {
  return {
    id: a.id,
    tenant_id: a.tenantId,
    ator_user_id: a.atorUserId,
    acao: a.acao,
    entidade_tipo: a.entidadeTipo,
    entidade_id: a.entidadeId ?? '',
    antes: a.antes ?? undefined,
    depois: a.depois ?? undefined,
    ip: a.ip ?? '',
    user_agent: a.userAgent ?? '',
    ocorrido_em: a.ocorridoEm,
  };
}

function contestacaoDeLinha(c: ContestacaoRow): Contestacao {
  return {
    id: c.id,
    tenant_id: c.tenantId,
    parceiro_id: c.parceiroId,
    lote_id: c.loteId,
    registro_id: c.registroId,
    motivo: c.motivo,
    observacao: c.observacao,
    status: c.status as Contestacao['status'],
    aberta_em: c.abertaEm,
    sla_vence_em: c.slaVenceEm,
    resolvido_em: c.resolvidoEm,
  };
}

function servicoDeLinha(s: ServicoRow): Servico {
  return {
    id: s.id,
    tenant_id: s.tenantId,
    nome: s.nome,
    descricao: s.descricao,
    preco: s.preco,
    prazo_dias: s.prazoDias,
    usa_listas: s.usaListas,
    ativo: s.ativo,
    created_at: s.createdAt,
  };
}

function contratoDeLinha(c: ContratoRow): Contrato {
  return {
    id: c.id,
    tenant_id: c.tenantId,
    nome_arquivo: c.nomeArquivo,
    mime_type: c.mimeType,
    conteudo_base64: c.conteudoBase64,
    atualizado_em: c.atualizadoEm,
  };
}

function pixCobrancaDeLinha(p: PixCobrancaRow): PixCobranca {
  return {
    id: p.id,
    tenant_id: p.tenantId,
    submissao_id: p.submissaoId,
    provider: p.provider,
    txid: p.txid,
    qr_code_base64: p.qrCodeBase64,
    copia_e_cola: p.copiaECola,
    valor: p.valor,
    status: p.status as PixCobranca['status'],
    expira_em: p.expiraEm,
    criado_em: p.criadoEm,
    confirmado_em: p.confirmadoEm,
  };
}

function notificacaoDeLinha(n: NotificacaoEnviadaRow): NotificacaoEnviada {
  return {
    id: n.id,
    tenant_id: n.tenantId,
    tipo: n.tipo as TipoNotificacao,
    destinatario_telefone: n.destinatarioTelefone,
    associado_id: n.associadoId,
    referencia_tipo: n.referenciaTipo,
    referencia_id: n.referenciaId,
    mensagem: n.mensagem,
    provider_message_id: n.providerMessageId,
    status: n.status,
    enviado_em: n.enviadoEm,
  };
}

function automacaoConfigDeLinha(a: AutomacaoConfigRow): AutomacaoConfig {
  return {
    chave: a.chave as TipoNotificacao,
    tenant_id: a.tenantId,
    ativo: a.ativo,
    config: a.config,
    atualizado_em: a.atualizadoEm,
  };
}

function novoId(prefixo: string): string {
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------
// Sessão de demonstração (troca de papel) — não é autenticação real, não
// precisa de persistência: sobrevive só enquanto o processo estiver de pé.
// ---------------------------------------------------------------------

let activeUser: UserSession = SEED_USERS[0]!;

function getSession(): UserSession {
  return activeUser;
}

function setRole(role: UserRole): UserSession {
  const user = SEED_USERS.find((u) => u.role === role) ?? {
    id: `usr-${role}-auto`,
    tenant_id: ABDCM_TENANT_ID,
    nome: `Usuário (${role})`,
    email: `${role}@abdcm.org.br`,
    role,
  };
  activeUser = user;
  return user;
}

// ---------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------

async function getLotes(): Promise<Lote[]> {
  const linhas = await db().select().from(schema.lotes);
  return linhas.map(loteDeLinha);
}

async function getAssociados(): Promise<Associado[]> {
  const linhas = await db().select().from(schema.associados);
  return linhas.map(associadoDeLinha);
}

async function getRegistros(): Promise<Registro[]> {
  const linhas = await db().select().from(schema.registros);
  return linhas.map(registroDeLinha);
}

async function getSubmissoes(): Promise<Submissao[]> {
  const linhas = await db().select().from(schema.submissoes);
  return linhas.map(submissaoDeLinha);
}

async function getProcessEvents(): Promise<ProcessEvent[]> {
  const linhas = await db().select().from(schema.processEvents);
  return linhas.map(eventoDeLinha);
}

async function getAuditLogs(): Promise<AuditLog[]> {
  const linhas = await db().select().from(schema.auditLog);
  return linhas.map(auditoriaDeLinha);
}

// ---------------------------------------------------------------------
// Escritas
// ---------------------------------------------------------------------

/** Submete lote de registros para processamento (cria Submissão PIX e bloqueia nomes). */
const PIX_EXPIRACAO_SEGUNDOS = 60 * 60; // 60 minutos, conforme CLAUDE.md

/** Gera a cobrança PIX (mock ou Asaas, conforme PIX_PROVIDER) pra uma submissão recém-criada. */
async function criarCobrancaPix(submissao: Submissao): Promise<PixCobranca> {
  const parceiro = SEED_USERS.find((u) => u.parceiro_id === submissao.parceiro_id);
  const provider = getPixProvider();

  const cobranca = await provider.criarCobranca({
    valor: submissao.valor_total,
    referenciaExterna: submissao.id,
    pagador: { nome: parceiro?.nome ?? 'Parceiro ABDCM', cpfCnpj: '00000000000' },
    expiraEmSegundos: PIX_EXPIRACAO_SEGUNDOS,
    descricao: `ABDCM — ${submissao.nomes_count} nome(s) na Ação Coletiva`,
  });

  const id = novoId('pix');
  const now = new Date().toISOString();
  await db().insert(schema.pixCobrancas).values({
    id,
    tenantId: ABDCM_TENANT_ID,
    submissaoId: submissao.id,
    provider: pixProviderConfigurado() ? 'asaas' : 'mock',
    txid: cobranca.txid,
    qrCodeBase64: cobranca.qrCodeBase64 || null,
    copiaECola: cobranca.copiaECola,
    valor: submissao.valor_total,
    status: 'pendente',
    expiraEm: cobranca.expiraEm.toISOString(),
    criadoEm: now,
  });

  const [linha] = await db().select().from(schema.pixCobrancas).where(eq(schema.pixCobrancas.id, id));
  return pixCobrancaDeLinha(linha!);
}

async function submitBatch(
  registroIds: string[],
  atorUserId: string,
): Promise<{ submissao: Submissao; registros: Registro[]; pixCobranca: PixCobranca | null }> {
  if (!registroIds || registroIds.length === 0) {
    throw new Error('Nenhum registro selecionado para envio.');
  }

  const lote = await resolverLoteVigente();
  const precoUnitario = lote?.precoPorNome ?? 25000;

  const { submissao, registros } = await db().transaction(async (tx) => {
    const submissaoId = novoId('sub');
    const now = new Date().toISOString();

    await tx.insert(schema.submissoes).values({
      id: submissaoId,
      tenantId: ABDCM_TENANT_ID,
      parceiroId: 'parc-001',
      loteId: lote?.id ?? 'lote-124',
      nomesCount: registroIds.length,
      valorTotal: registroIds.length * precoUnitario,
      paymentStatus: 'pendente',
      submetidoEm: now,
    });

    const atualizados: Registro[] = [];
    for (const regId of registroIds) {
      const [atual] = await tx.select().from(schema.registros).where(eq(schema.registros.id, regId));
      if (!atual) continue;

      // I4: unit_price congela aqui, no momento do envio — não muda depois.
      await tx
        .update(schema.registros)
        .set({
          submissaoId,
          processStatus: 'enviado',
          isLocked: true,
          unitPrice: precoUnitario,
          enviadoEm: now,
          updatedAt: now,
        })
        .where(eq(schema.registros.id, regId));
      atualizados.push(
        registroDeLinha({
          ...atual,
          submissaoId,
          processStatus: 'enviado',
          isLocked: true,
          unitPrice: precoUnitario,
          enviadoEm: now,
          updatedAt: now,
        }),
      );

      await tx.insert(schema.processEvents).values({
        id: novoId('pe'),
        tenantId: atual.tenantId,
        registroId: atual.id,
        deStatus: atual.processStatus,
        paraStatus: 'enviado',
        atorTipo: 'parceiro',
        atorUserId,
        motivo: `Envio de lista (${registroIds.length} nomes) para ${lote?.nome ?? 'Ação Coletiva'}`,
        metadata: { submissao_id: submissaoId, valor_unitario: precoUnitario },
        ocorridoEm: now,
      });
    }

    await tx.insert(schema.auditLog).values({
      id: novoId('audit'),
      tenantId: ABDCM_TENANT_ID,
      atorUserId,
      acao: 'ENVIO_LISTA_PROCESSAMENTO',
      entidadeTipo: 'submissoes',
      entidadeId: submissaoId,
      depois: { nomes_count: registroIds.length, valor_total: registroIds.length * precoUnitario, lote_id: lote?.id },
      ip: '127.0.0.1',
      userAgent: 'ABDCM-Parceiro-Portal',
      ocorridoEm: now,
    });

    const [submissaoRow] = await tx.select().from(schema.submissoes).where(eq(schema.submissoes.id, submissaoId));
    return { submissao: submissaoDeLinha(submissaoRow!), registros: atualizados };
  });

  // Geração do PIX é uma chamada de rede — fica fora da transação de
  // propósito. Se falhar, a submissão continua existindo (pendente) e o
  // parceiro pode tentar de novo pela tela; nunca derruba o envio da lista.
  let pixCobranca: PixCobranca | null = null;
  try {
    pixCobranca = await criarCobrancaPix(submissao);
  } catch (err) {
    console.error(`Falha ao gerar PIX pra submissão ${submissao.id}:`, err);
  }

  return { submissao, registros, pixCobranca };
}

/** Confirma pagamento PIX da submissão (webhook / simulação). */
async function paySubmissao(
  submissaoId: string,
  atorUserId: string,
): Promise<{ submissao: Submissao; registros: Registro[] }> {
  return db().transaction(async (tx) => {
    const [sub] = await tx.select().from(schema.submissoes).where(eq(schema.submissoes.id, submissaoId));
    if (!sub) throw new Error(`Submissão ${submissaoId} não encontrada.`);

    // Idempotência (webhook duplicado / dupla confirmação não reprocessa).
    if (sub.paymentStatus === 'pago') {
      const jaAtualizados = await tx.select().from(schema.registros).where(eq(schema.registros.submissaoId, submissaoId));
      return { submissao: submissaoDeLinha(sub), registros: jaAtualizados.map(registroDeLinha) };
    }

    const now = new Date().toISOString();
    await tx
      .update(schema.submissoes)
      .set({ paymentStatus: 'pago', confirmadoEm: now })
      .where(eq(schema.submissoes.id, submissaoId));

    await tx
      .update(schema.pixCobrancas)
      .set({ status: 'pago', confirmadoEm: now })
      .where(eq(schema.pixCobrancas.submissaoId, submissaoId));

    const afetados = await tx.select().from(schema.registros).where(eq(schema.registros.submissaoId, submissaoId));
    const atualizados: Registro[] = [];
    for (const atual of afetados) {
      await tx
        .update(schema.registros)
        .set({ processStatus: 'pago', updatedAt: now })
        .where(eq(schema.registros.id, atual.id));
      atualizados.push(registroDeLinha({ ...atual, processStatus: 'pago', updatedAt: now }));

      await tx.insert(schema.processEvents).values({
        id: novoId('pe'),
        tenantId: atual.tenantId,
        registroId: atual.id,
        deStatus: atual.processStatus,
        paraStatus: 'pago',
        atorTipo: 'integracao',
        atorUserId,
        motivo: 'Confirmação de pagamento via PIX instantâneo',
        metadata: { submissao_id: submissaoId },
        ocorridoEm: now,
      });
    }

    const [submissaoRow] = await tx.select().from(schema.submissoes).where(eq(schema.submissoes.id, submissaoId));
    return { submissao: submissaoDeLinha(submissaoRow!), registros: atualizados };
  });
}

/**
 * Recebe o webhook do provedor de PIX, valida e — se for confirmação de
 * pagamento — casa com a cobrança pelo txid e chama paySubmissao (que já é
 * idempotente). Webhook fora de ordem ou de uma cobrança não confirmada
 * (pendente/expirado) não altera nada.
 */
async function confirmarPagamentoPixWebhook(
  payload: unknown,
  headers: Record<string, string | string[] | undefined>,
): Promise<{ submissao: Submissao; registros: Registro[] } | null> {
  const evento = await getPixProvider().validarWebhook(payload, headers);
  if (evento.status !== 'pago') return null;

  const [cobranca] = await db().select().from(schema.pixCobrancas).where(eq(schema.pixCobrancas.txid, evento.txid));
  if (!cobranca) throw new Error(`Cobrança PIX com txid "${evento.txid}" não encontrada.`);

  return paySubmissao(cobranca.submissaoId, 'system-pix');
}

/** Aprova submissão na conciliação bancária. */
async function approveSubmissao(
  submissaoId: string,
  atorUserId: string,
  motivo?: string,
): Promise<{ submissao: Submissao; registros: Registro[] }> {
  const res = await paySubmissao(submissaoId, atorUserId);
  if (motivo) {
    await db().update(schema.submissoes).set({ motivoObservacao: motivo }).where(eq(schema.submissoes.id, submissaoId));
    res.submissao.motivo_observacao = motivo;
  }
  await db().insert(schema.auditLog).values({
    id: novoId('audit'),
    tenantId: ABDCM_TENANT_ID,
    atorUserId,
    acao: 'APROVACAO_COMPROVANTE_FINANCEIRO',
    entidadeTipo: 'submissoes',
    entidadeId: submissaoId,
    depois: { motivo: motivo ?? 'Comprovante conferido e aprovado' },
    ip: '127.0.0.1',
    userAgent: 'ABDCM-Admin-Console',
    ocorridoEm: new Date().toISOString(),
  });
  return res;
}

/** Reprova submissão (comprovante divergente ou ilegível). */
async function reproveSubmissao(
  submissaoId: string,
  atorUserId: string,
  motivo: string,
): Promise<{ submissao: Submissao; registros: Registro[] }> {
  return db().transaction(async (tx) => {
    const [sub] = await tx.select().from(schema.submissoes).where(eq(schema.submissoes.id, submissaoId));
    if (!sub) throw new Error(`Submissão ${submissaoId} não encontrada.`);

    const now = new Date().toISOString();
    await tx
      .update(schema.submissoes)
      .set({ paymentStatus: 'reprovado', revisadoPorUserId: atorUserId, motivoObservacao: motivo })
      .where(eq(schema.submissoes.id, submissaoId));

    const afetados = await tx.select().from(schema.registros).where(eq(schema.registros.submissaoId, submissaoId));
    const atualizados: Registro[] = [];
    for (const atual of afetados) {
      await tx
        .update(schema.registros)
        .set({ processStatus: 'reprovado', isLocked: false, updatedAt: now })
        .where(eq(schema.registros.id, atual.id));
      atualizados.push(registroDeLinha({ ...atual, processStatus: 'reprovado', isLocked: false, updatedAt: now }));

      await tx.insert(schema.processEvents).values({
        id: novoId('pe'),
        tenantId: atual.tenantId,
        registroId: atual.id,
        deStatus: atual.processStatus,
        paraStatus: 'reprovado',
        atorTipo: 'admin',
        atorUserId,
        motivo: motivo || 'Comprovante reprovado na conciliação bancária',
        metadata: { submissao_id: submissaoId },
        ocorridoEm: now,
      });
    }

    await tx.insert(schema.auditLog).values({
      id: novoId('audit'),
      tenantId: ABDCM_TENANT_ID,
      atorUserId,
      acao: 'REPROVACAO_COMPROVANTE_FINANCEIRO',
      entidadeTipo: 'submissoes',
      entidadeId: submissaoId,
      depois: { motivo },
      ip: '127.0.0.1',
      userAgent: 'ABDCM-Admin-Console',
      ocorridoEm: now,
    });

    const [submissaoRow] = await tx.select().from(schema.submissoes).where(eq(schema.submissoes.id, submissaoId));
    return { submissao: submissaoDeLinha(submissaoRow!), registros: atualizados };
  });
}

/** Reenvia comprovante de uma submissão reprovada — volta para a fila de conciliação. */
async function attachComprovante(
  submissaoId: string,
  atorUserId: string,
  comprovanteBase64: string,
  mimeType: string,
): Promise<Submissao> {
  return db().transaction(async (tx) => {
    const [sub] = await tx.select().from(schema.submissoes).where(eq(schema.submissoes.id, submissaoId));
    if (!sub) throw new Error(`Submissão ${submissaoId} não encontrada.`);
    if (sub.paymentStatus !== 'reprovado') {
      throw new Error('Só é possível anexar novo comprovante em uma submissão reprovada.');
    }
    if (!comprovanteBase64) throw new Error('Comprovante não informado.');

    const now = new Date().toISOString();
    await tx
      .update(schema.submissoes)
      .set({
        paymentStatus: 'pendente',
        comprovanteBase64,
        comprovanteMime: mimeType,
        revisadoPorUserId: null,
      })
      .where(eq(schema.submissoes.id, submissaoId));

    const afetados = await tx
      .select()
      .from(schema.registros)
      .where(and(eq(schema.registros.submissaoId, submissaoId), eq(schema.registros.processStatus, 'reprovado')));

    for (const atual of afetados) {
      await tx
        .update(schema.registros)
        .set({ processStatus: 'aguardando_pagamento', updatedAt: now })
        .where(eq(schema.registros.id, atual.id));

      await tx.insert(schema.processEvents).values({
        id: novoId('pe'),
        tenantId: atual.tenantId,
        registroId: atual.id,
        deStatus: atual.processStatus,
        paraStatus: 'aguardando_pagamento',
        atorTipo: 'parceiro',
        atorUserId,
        motivo: 'Novo comprovante anexado pelo parceiro',
        metadata: { submissao_id: submissaoId },
        ocorridoEm: now,
      });
    }

    await tx.insert(schema.auditLog).values({
      id: novoId('audit'),
      tenantId: ABDCM_TENANT_ID,
      atorUserId,
      acao: 'REENVIO_COMPROVANTE_FINANCEIRO',
      entidadeTipo: 'submissoes',
      entidadeId: submissaoId,
      depois: { mimeType },
      ip: '127.0.0.1',
      userAgent: 'ABDCM-Portal-Parceiro',
      ocorridoEm: now,
    });

    const [submissaoRow] = await tx.select().from(schema.submissoes).where(eq(schema.submissoes.id, submissaoId));
    return submissaoDeLinha(submissaoRow!);
  });
}

/** Cancela submissão pendente e libera os registros de volta para "pendente". */
async function cancelSubmissao(
  submissaoId: string,
  atorUserId: string,
  atorTipo: 'parceiro' | 'admin' = 'admin',
): Promise<void> {
  await db().transaction(async (tx) => {
    const [submissao] = await tx.select().from(schema.submissoes).where(eq(schema.submissoes.id, submissaoId));
    if (!submissao) throw new Error(`Submissão ${submissaoId} não encontrada.`);

    const afetados = await tx
      .select()
      .from(schema.registros)
      .where(and(eq(schema.registros.submissaoId, submissaoId), eq(schema.registros.processStatus, 'enviado')));

    const now = new Date().toISOString();
    for (const atual of afetados) {
      await tx
        .update(schema.registros)
        .set({ submissaoId: null, processStatus: 'pendente', isLocked: false, updatedAt: now })
        .where(eq(schema.registros.id, atual.id));

      await tx.insert(schema.processEvents).values({
        id: novoId('pe'),
        tenantId: atual.tenantId,
        registroId: atual.id,
        deStatus: 'enviado',
        paraStatus: 'pendente',
        atorTipo,
        atorUserId,
        motivo: 'Cancelamento da submissão',
        metadata: { submissao_id: submissaoId },
        ocorridoEm: now,
      });
    }

    // A cobrança PIX referencia a submissão (FK) — precisa sair antes, senão
    // o delete abaixo esbarra na constraint e a submissão nunca é cancelada.
    await tx.delete(schema.pixCobrancas).where(eq(schema.pixCobrancas.submissaoId, submissaoId));
    await tx.delete(schema.submissoes).where(eq(schema.submissoes.id, submissaoId));
  });
}

/** Lote vigente pra qualquer fluxo que precise de "o lote de hoje": o aberto, ou lote-124 de fallback. */
async function resolverLoteVigente(): Promise<LoteRow | undefined> {
  const abertos = await db().select().from(schema.lotes).where(eq(schema.lotes.status, 'aberto'));
  if (abertos[0]) return abertos[0];
  const [fallback] = await db().select().from(schema.lotes).where(eq(schema.lotes.id, 'lote-124'));
  return fallback;
}

/** Adiciona novo registro avulso ou vindo de planilha. */
async function addRegistro(data: {
  nome: string;
  cpf_cnpj: string;
  tipo_documento?: 'cpf' | 'cnpj';
  telefone_whatsapp?: string;
  lote_id?: string;
  origem?: 'manual' | 'planilha';
}): Promise<Registro> {
  if (!data.nome || !data.cpf_cnpj) {
    throw new Error('Nome e documento (CPF/CNPJ) são obrigatórios.');
  }

  const limpo = data.cpf_cnpj.replace(/\D/g, '');
  const isCnpj = limpo.length > 11;
  const tipo = data.tipo_documento ?? (isCnpj ? 'cnpj' : 'cpf');
  const loteVigente = data.lote_id ? undefined : await resolverLoteVigente();
  const loteId = data.lote_id ?? loteVigente?.id ?? 'lote-124';
  const precoUnitario = loteVigente?.precoPorNome ?? 25000;
  const now = new Date().toISOString();
  const id = novoId('reg');
  const iniciais = data.nome
    .split(' ')
    .map((w) => w[0])
    .slice(0, 3)
    .join('')
    .toUpperCase();

  const todos = await db().select({ id: schema.registros.id }).from(schema.registros);
  const total = todos.length;

  // I6: cpf_cnpj sempre mascarado por padrão — o valor completo só existe em
  // cpf_cnpj_raw, revelado sob clique via revealDocument() com auditoria.
  // Cria um Associado de verdade (não um id fabricado) sempre que houver
  // telefone — é o que torna o bot/automação de WhatsApp possível (I7).
  const associadoId = data.telefone_whatsapp ? novoId('assoc') : `assoc-${id}`;
  if (data.telefone_whatsapp) {
    await db().insert(schema.associados).values({
      id: associadoId,
      tenantId: ABDCM_TENANT_ID,
      parceiroId: 'parc-001',
      nome: data.nome.trim(),
      cpfCnpjRaw: limpo,
      cpfCnpj: maskDocument(limpo),
      tipoDocumento: tipo,
      telefoneWhatsapp: data.telefone_whatsapp.trim(),
      statusFiliacao: 'pre_cadastro',
      createdAt: now,
    });
  }

  const novo = {
    id,
    tenantId: ABDCM_TENANT_ID,
    loteId,
    parceiroId: 'parc-001',
    associadoId,
    nome: data.nome.trim(),
    cpfCnpjRaw: limpo,
    cpfCnpj: maskDocument(limpo),
    tipoDocumento: tipo,
    processStatus: 'pendente' as const,
    isLocked: false,
    unitPrice: precoUnitario,
    isBonus: false,
    protocolCode: `ABDCM-AC124-${total + 1}-${iniciais}`,
    origem: data.origem ?? 'manual',
    createdAt: now,
    updatedAt: now,
  };

  await db().insert(schema.registros).values(novo);
  return registroDeLinha(novo as RegistroRow);
}

/** Exclui registro ainda pendente e não bloqueado. */
async function deleteRegistro(registroId: string): Promise<void> {
  const [reg] = await db().select().from(schema.registros).where(eq(schema.registros.id, registroId));
  if (!reg) throw new Error('Registro não localizado.');
  if (reg.isLocked || reg.processStatus !== 'pendente') {
    throw new Error('Registros já enviados ou bloqueados não podem ser removidos.');
  }
  await db().delete(schema.registros).where(eq(schema.registros.id, registroId));
}

/** Executa transição de status com validação rigorosa (I1, I2). */
async function transitionStatus(
  registroId: string,
  paraStatus: ProcessStatus,
  motivo: string,
  atorUserId: string,
  atorTipo: 'parceiro' | 'admin' | 'system' | 'integracao',
  metadata?: Record<string, unknown>,
): Promise<{ registro: Registro; event: ProcessEvent }> {
  return db().transaction(async (tx) => {
    const [atual] = await tx.select().from(schema.registros).where(eq(schema.registros.id, registroId));
    if (!atual) throw new Error(`Registro "${registroId}" não encontrado.`);

    const { novoStatus, processEvent } = transitionProcessStatus({
      registroId: atual.id,
      tenantId: atual.tenantId,
      deStatus: atual.processStatus as ProcessStatus,
      paraStatus,
      atorTipo,
      atorUserId,
      motivo,
      metadata,
    });

    const now = new Date().toISOString();
    const campos: Partial<RegistroRow> = { processStatus: novoStatus, updatedAt: now };
    if (novoStatus === 'pago') campos.isLocked = true;
    if (novoStatus === 'protocolado') campos.protocoladoEm = now;
    if (novoStatus === 'baixado') campos.baixadoEm = now;

    await tx.update(schema.registros).set(campos).where(eq(schema.registros.id, registroId));

    await tx.insert(schema.processEvents).values({
      id: processEvent.id,
      tenantId: processEvent.tenant_id,
      registroId: processEvent.registro_id,
      deStatus: processEvent.de_status,
      paraStatus: processEvent.para_status,
      atorTipo: processEvent.ator_tipo,
      atorUserId: processEvent.ator_user_id,
      motivo: processEvent.motivo,
      metadata: processEvent.metadata ?? null,
      ocorridoEm: processEvent.ocorrido_em,
    });

    await tx.insert(schema.auditLog).values({
      id: novoId('audit'),
      tenantId: atual.tenantId,
      atorUserId,
      acao: 'TRANSICAO_STATUS',
      entidadeTipo: 'registros',
      entidadeId: atual.id,
      antes: { process_status: atual.processStatus },
      depois: { process_status: novoStatus, motivo },
      ip: '127.0.0.1',
      userAgent: 'ABDCM-Server/1.0',
      ocorridoEm: now,
    });

    return { registro: registroDeLinha({ ...atual, ...campos }), event: processEvent };
  });
}

/** Revelação de documento sob clique, com registro de auditoria obrigatório (I6). */
async function revealDocument(registroId: string, userId: string): Promise<string> {
  const [reg] = await db().select().from(schema.registros).where(eq(schema.registros.id, registroId));
  if (!reg) throw new Error('Registro não localizado.');

  await db().insert(schema.auditLog).values({
    id: novoId('audit'),
    tenantId: reg.tenantId,
    atorUserId: userId,
    acao: 'REVELACAO_DOCUMENTO_LGPD',
    entidadeTipo: 'registros',
    entidadeId: reg.id,
    ip: '127.0.0.1',
    userAgent: 'ABDCM-Admin-Console',
    ocorridoEm: new Date().toISOString(),
  });

  return reg.cpfCnpjRaw;
}

/** Atualiza dados de configuração do lote (ex.: prazo de encerramento) — só admin usa. */
async function updateLote(
  id: string,
  atorUserId: string,
  campos: { closesAt?: string; nome?: string },
): Promise<Lote> {
  const [atual] = await db().select().from(schema.lotes).where(eq(schema.lotes.id, id));
  if (!atual) throw new Error('Lote não encontrado.');

  const patch: Partial<LoteRow> = {};
  if (campos.closesAt) patch.closesAt = campos.closesAt;
  if (campos.nome) patch.nome = campos.nome;

  await db().update(schema.lotes).set(patch).where(eq(schema.lotes.id, id));

  await db().insert(schema.auditLog).values({
    id: novoId('audit'),
    tenantId: atual.tenantId,
    atorUserId,
    acao: 'LOTE_CONFIGURACAO_ALTERADA',
    entidadeTipo: 'lotes',
    entidadeId: id,
    antes: { closesAt: atual.closesAt, nome: atual.nome },
    depois: campos,
    ip: '127.0.0.1',
    userAgent: 'ABDCM-Admin-Console',
    ocorridoEm: new Date().toISOString(),
  });

  return loteDeLinha({ ...atual, ...patch });
}

/** Cria uma nova Ação Coletiva (lote) — só a equipe ABDCM cria (I1/I9).
 * O protocolo (referencia_protocolo) é sempre AAAA-MM-DD da data de
 * criação, gerado aqui no servidor e nunca aceito do cliente. Se já existir
 * um lote 'aberto', a nova ação nasce como 'rascunho' — pra não ter dois
 * lotes vigentes ao mesmo tempo — e o admin decide depois quando abrir
 * esta e encerrar a anterior. */
async function createLote(
  atorUserId: string,
  campos: {
    nome: string;
    codigo?: string | null;
    numeroProcesso?: string | null;
    abreEm: string;
    closesAt: string;
    precoPorNome: number;
    bureaus: string[];
  },
): Promise<Lote> {
  const existentes = await db().select().from(schema.lotes);
  const numeroSequencial = existentes.reduce((max, l) => Math.max(max, l.numeroSequencial), 0) + 1;
  const jaTemLoteAberto = existentes.some((l) => l.status === 'aberto');

  const agora = new Date().toISOString();
  const deadlineTime = campos.closesAt.slice(11, 19) || '23:59:59';

  const linha: LoteRow = {
    id: novoId('lote'),
    tenantId: ABDCM_TENANT_ID,
    nome: campos.nome,
    codigo: campos.codigo || null,
    numeroSequencial,
    status: jaTemLoteAberto ? 'rascunho' : 'aberto',
    abreEm: campos.abreEm,
    closesAt: campos.closesAt,
    deadlineTime,
    precoPorNome: campos.precoPorNome,
    bureaus: campos.bureaus,
    referenciaProtocolo: agora.slice(0, 10),
    numeroProcesso: campos.numeroProcesso || null,
    varaTribunal: null,
    juiz: null,
    dataProtocolo: null,
    dataDistribuicao: null,
    liminarStatus: null,
    concluidoEm: null,
    createdAt: agora,
  };

  await db().insert(schema.lotes).values(linha);

  await db().insert(schema.auditLog).values({
    id: novoId('audit'),
    tenantId: ABDCM_TENANT_ID,
    atorUserId,
    acao: 'LOTE_CRIADO',
    entidadeTipo: 'lotes',
    entidadeId: linha.id,
    antes: null,
    depois: { nome: linha.nome, codigo: linha.codigo, status: linha.status },
    ip: '127.0.0.1',
    userAgent: 'ABDCM-Admin-Console',
    ocorridoEm: agora,
  });

  return loteDeLinha(linha);
}

// ---------------------------------------------------------------------
// Contestações ("Reclame Aqui")
// ---------------------------------------------------------------------

async function getContestacoes(): Promise<Contestacao[]> {
  const linhas = await db().select().from(schema.contestacoes);
  return linhas.map(contestacaoDeLinha);
}

/** Abre uma contestação. Bloqueada até 72h após a conclusão do lote — validado no servidor. */
async function createContestacao(data: {
  loteId: string;
  registroId?: string | null;
  motivo: string;
  observacao?: string;
  parceiroId: string;
}): Promise<Contestacao> {
  const [lote] = await db().select().from(schema.lotes).where(eq(schema.lotes.id, data.loteId));
  if (!lote) throw new Error('Lote não encontrado.');
  if (lote.status !== 'concluido' || !lote.concluidoEm) {
    throw new Error('Só é possível abrir contestação para uma Ação Coletiva já concluída.');
  }

  const horasDesdeConclusao = (Date.now() - new Date(lote.concluidoEm).getTime()) / 3_600_000;
  if (horasDesdeConclusao < 72) {
    const faltam = Math.ceil(72 - horasDesdeConclusao);
    throw new Error(`Contestação libera 72h após a conclusão do lote — faltam aproximadamente ${faltam}h.`);
  }

  if (!data.motivo || !data.motivo.trim()) {
    throw new Error('Motivo é obrigatório.');
  }

  const now = new Date();
  const id = novoId('cont');
  const novo = {
    id,
    tenantId: ABDCM_TENANT_ID,
    parceiroId: data.parceiroId,
    loteId: data.loteId,
    registroId: data.registroId ?? null,
    motivo: data.motivo.trim(),
    observacao: data.observacao?.trim() || null,
    status: 'aberta' as const,
    abertaEm: now.toISOString(),
    slaVenceEm: new Date(now.getTime() + 48 * 3_600_000).toISOString(),
    resolvidoEm: null,
  };

  await db().insert(schema.contestacoes).values(novo);
  return contestacaoDeLinha(novo as ContestacaoRow);
}

// ---------------------------------------------------------------------
// Catálogo de serviços (configurado pelo admin)
// ---------------------------------------------------------------------

async function getServicos(): Promise<Servico[]> {
  const linhas = await db().select().from(schema.servicos);
  return linhas.map(servicoDeLinha);
}

async function createServico(data: {
  nome: string;
  descricao?: string;
  preco: number;
  prazoDias: number;
  usaListas: boolean;
}): Promise<Servico> {
  if (!data.nome?.trim()) throw new Error('Nome do serviço é obrigatório.');
  if (!Number.isInteger(data.preco) || data.preco < 0) throw new Error('Preço deve ser um valor inteiro em centavos.');
  if (!Number.isInteger(data.prazoDias) || data.prazoDias < 0) throw new Error('Prazo deve ser um número inteiro de dias.');

  const novo = {
    id: novoId('serv'),
    tenantId: ABDCM_TENANT_ID,
    nome: data.nome.trim(),
    descricao: data.descricao?.trim() || null,
    preco: data.preco,
    prazoDias: data.prazoDias,
    usaListas: data.usaListas,
    ativo: true,
    createdAt: new Date().toISOString(),
  };
  await db().insert(schema.servicos).values(novo);
  return servicoDeLinha(novo as ServicoRow);
}

async function updateServico(
  id: string,
  data: Partial<{ nome: string; descricao: string | null; preco: number; prazoDias: number; usaListas: boolean; ativo: boolean }>,
): Promise<Servico> {
  const [atual] = await db().select().from(schema.servicos).where(eq(schema.servicos.id, id));
  if (!atual) throw new Error('Serviço não encontrado.');

  const patch: Partial<ServicoRow> = {};
  if (data.nome !== undefined) patch.nome = data.nome;
  if (data.descricao !== undefined) patch.descricao = data.descricao;
  if (data.preco !== undefined) patch.preco = data.preco;
  if (data.prazoDias !== undefined) patch.prazoDias = data.prazoDias;
  if (data.usaListas !== undefined) patch.usaListas = data.usaListas;
  if (data.ativo !== undefined) patch.ativo = data.ativo;

  await db().update(schema.servicos).set(patch).where(eq(schema.servicos.id, id));
  return servicoDeLinha({ ...atual, ...patch });
}

const SERVICO_DELETE_REASON_CODES = ['duplicado', 'descontinuado', 'cadastrado_por_engano', 'outro'] as const;

/** Remove um serviço do catálogo. Ação destrutiva: exige reason_code de lista fechada (I11). */
async function deleteServico(
  id: string,
  atorUserId: string,
  reasonCode: string,
  observacao?: string,
): Promise<void> {
  if (!SERVICO_DELETE_REASON_CODES.includes(reasonCode as (typeof SERVICO_DELETE_REASON_CODES)[number])) {
    throw new Error('Motivo inválido para exclusão de serviço.');
  }
  const [atual] = await db().select().from(schema.servicos).where(eq(schema.servicos.id, id));
  if (!atual) throw new Error('Serviço não encontrado.');

  await db().transaction(async (tx) => {
    await tx.delete(schema.servicos).where(eq(schema.servicos.id, id));
    await tx.insert(schema.auditLog).values({
      id: novoId('audit'),
      tenantId: ABDCM_TENANT_ID,
      atorUserId,
      acao: 'SERVICO_REMOVIDO',
      entidadeTipo: 'servicos',
      entidadeId: id,
      antes: { nome: atual.nome, preco: atual.preco, prazoDias: atual.prazoDias },
      depois: { reasonCode, observacao: observacao?.trim() || null },
      ip: '127.0.0.1',
      userAgent: 'ABDCM-Admin-Console',
      ocorridoEm: new Date().toISOString(),
    });
  });
}

// ---------------------------------------------------------------------
// Contrato-modelo (o admin anexa; associados/parceiros só leem)
// ---------------------------------------------------------------------

async function getContrato(): Promise<Contrato | null> {
  const linhas = await db().select().from(schema.contratos).where(eq(schema.contratos.tenantId, ABDCM_TENANT_ID));
  const linha = linhas[0];
  return linha ? contratoDeLinha(linha) : null;
}

/** Substitui o contrato vigente (mantém só um por tenant). */
async function setContrato(data: { nomeArquivo: string; mimeType: string; conteudoBase64: string }): Promise<Contrato> {
  if (!data.nomeArquivo || !data.conteudoBase64) {
    throw new Error('Arquivo do contrato é obrigatório.');
  }
  return db().transaction(async (tx) => {
    await tx.delete(schema.contratos).where(eq(schema.contratos.tenantId, ABDCM_TENANT_ID));
    const novo = {
      id: novoId('contrato'),
      tenantId: ABDCM_TENANT_ID,
      nomeArquivo: data.nomeArquivo,
      mimeType: data.mimeType,
      conteudoBase64: data.conteudoBase64,
      atualizadoEm: new Date().toISOString(),
    };
    await tx.insert(schema.contratos).values(novo);
    return contratoDeLinha(novo as ContratoRow);
  });
}

// ---------------------------------------------------------------------
// PIX (integrations/pix) e Automações de WhatsApp (integrations/whatsapp)
// ---------------------------------------------------------------------

async function getPixCobrancaPorSubmissao(submissaoId: string): Promise<PixCobranca | null> {
  const linhas = await db()
    .select()
    .from(schema.pixCobrancas)
    .where(eq(schema.pixCobrancas.submissaoId, submissaoId));
  const linha = linhas[linhas.length - 1];
  return linha ? pixCobrancaDeLinha(linha) : null;
}

// Metadados fixos de cada regra de automação — a UI (aba Automações) usa
// isso pra mostrar nome/descrição/exemplo mesmo antes de existir linha no
// banco; o banco só guarda o ativo/inativo e os parâmetros configuráveis.
export const AUTOMACOES_DISPONIVEIS: Record<
  TipoNotificacao,
  { nome: string; descricao: string; exemplo: string; configPadrao: Record<string, unknown> }
> = {
  proximo_lote: {
    nome: 'Próxima Ação Coletiva abrindo',
    descricao: 'Avisa todos os associados ativos quando uma nova lista (lote) abre pra captação.',
    exemplo:
      'Boa tarde! Aqui é da ABDCM 👋 Passando pra avisar que a próxima Lista Limpa Nome (AÇÃO COLETIVA 125) abre quarta-feira às 18:00. Aproveita pra anexar seus nomes com o parceiro que cuidou da sua filiação!',
    configPadrao: {},
  },
  follow_up_lista: {
    nome: 'Follow-up antes do encerramento',
    descricao: 'Lembra associados que ainda não entraram na lista aberta, um pouco antes dela fechar.',
    exemplo:
      'Oi Luiz! Notei que você ainda não anexou os seus nomes na nossa plataforma. Anexa agora pra não perder a oportunidade de ter seus nomes limpos!',
    configPadrao: { horasAntesDoFechamento: 24 },
  },
  status_processo: {
    nome: 'Status do processo',
    descricao: 'Avisa quando os nomes do associado avançam de fase (protocolado, baixado, recusado).',
    exemplo:
      'Boa tarde João! Passando pra avisar que os nomes anexados na Lista de quarta-feira (Lote 5465) — Serasa, SPC, Boa Vista, Cartórios de Protesto — se atribuíram ao processo e estamos aguardando as baixas começarem.',
    configPadrao: {},
  },
  pagamento_pendente: {
    nome: 'Pagamento PIX pendente',
    descricao: 'Pergunta se deu algum problema quando o PIX de uma lista fica pendente por muito tempo.',
    exemplo:
      'Oi Ana! Vimos que o pagamento PIX da sua lista ainda está pendente. Aconteceu algum problema? Se precisar de ajuda é só responder por aqui 🙂',
    configPadrao: { horasParaAvisar: 12 },
  },
  lote_encerrado: {
    nome: 'Encerramento de Ação Coletiva',
    descricao:
      'Avisa a equipe ABDCM (números cadastrados abaixo, não associados) quando uma Ação Coletiva é encerrada, com o link do pacote (planilha + documentos) pra retirar.',
    exemplo:
      'Ação Coletiva 124 encerrada! Foram 87 nomes captados. Baixe a documentação completa aqui: https://... (link válido por 7 dias)',
    configPadrao: { numeros: [] },
  },
};

export async function getAutomacoesConfig(): Promise<AutomacaoConfig[]> {
  const linhas = await db().select().from(schema.automacoesConfig).where(eq(schema.automacoesConfig.tenantId, ABDCM_TENANT_ID));
  const porChave = new Map(linhas.map((l) => [l.chave, l]));
  const agora = new Date().toISOString();

  return (Object.keys(AUTOMACOES_DISPONIVEIS) as TipoNotificacao[]).map((chave) => {
    const linha = porChave.get(chave);
    if (linha) return automacaoConfigDeLinha(linha);
    return {
      chave,
      tenant_id: ABDCM_TENANT_ID,
      ativo: true,
      config: AUTOMACOES_DISPONIVEIS[chave].configPadrao,
      atualizado_em: agora,
    };
  });
}

async function setAutomacaoConfig(
  chave: TipoNotificacao,
  atorUserId: string,
  campos: { ativo?: boolean; config?: Record<string, unknown> },
): Promise<AutomacaoConfig> {
  if (!(chave in AUTOMACOES_DISPONIVEIS)) throw new Error(`Automação "${chave}" não existe.`);

  const now = new Date().toISOString();
  const [existente] = await db().select().from(schema.automacoesConfig).where(eq(schema.automacoesConfig.chave, chave));

  const ativo = campos.ativo ?? existente?.ativo ?? true;
  const config = campos.config ?? existente?.config ?? AUTOMACOES_DISPONIVEIS[chave].configPadrao;

  if (existente) {
    await db().update(schema.automacoesConfig).set({ ativo, config, atualizadoEm: now }).where(eq(schema.automacoesConfig.chave, chave));
  } else {
    await db().insert(schema.automacoesConfig).values({ chave, tenantId: ABDCM_TENANT_ID, ativo, config, atualizadoEm: now });
  }

  await db().insert(schema.auditLog).values({
    id: novoId('audit'),
    tenantId: ABDCM_TENANT_ID,
    atorUserId,
    acao: 'AUTOMACAO_CONFIGURACAO_ALTERADA',
    entidadeTipo: 'automacoes_config',
    entidadeId: chave,
    depois: { ativo, config },
    ip: '127.0.0.1',
    userAgent: 'ABDCM-Admin-Console',
    ocorridoEm: now,
  });

  return { chave, tenant_id: ABDCM_TENANT_ID, ativo, config, atualizado_em: now };
}

async function getNotificacoesLog(limite = 50): Promise<NotificacaoEnviada[]> {
  const linhas = await db()
    .select()
    .from(schema.notificacoesEnviadas)
    .where(eq(schema.notificacoesEnviadas.tenantId, ABDCM_TENANT_ID))
    .orderBy(desc(schema.notificacoesEnviadas.enviadoEm))
    .limit(limite);
  return linhas.map(notificacaoDeLinha);
}

// ---------------------------------------------------------------------
// Documentos do associado (CNH/RG) — upload em massa direto pro storage,
// o servidor só autoriza (URL assinada) e confirma depois que o navegador
// já mandou o arquivo. Ver src/integrations/storage.
// ---------------------------------------------------------------------

// cnh/rg são de pessoa física; comprovante_inscricao (cartão CNPJ) e
// ficha_associativa valem pros dois — CNPJ não tem CNH/RG, tem seu próprio
// comprovante de inscrição no lugar.
const TIPOS_DOCUMENTO = ['cnh', 'rg', 'comprovante_inscricao', 'ficha_associativa'] as const;
type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];
const URL_STORAGE_EXPIRA_SEGUNDOS = 15 * 60;

/** As URLs do MockStorageProvider são relativas (pensadas pra o navegador
 * resolver contra a própria origem) — em chamadas feitas pelo servidor
 * (como montar o pacote do lote) precisam virar absolutas antes do fetch.
 * URLs do provider real (R2, presignadas) já vêm absolutas e passam direto. */
function resolverUrlAbsoluta(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const porta = Number(process.env.PORT) || 3000;
  return `http://127.0.0.1:${porta}${url}`;
}

function extensaoPorMime(mime: string): string {
  const mapa: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  };
  return mapa[mime] ?? 'bin';
}

export interface PreviewDocumentoItem {
  cpf_cnpj_raw: string;
  associado_id: string | null;
  nome: string | null;
  ja_tem_cnh: boolean;
  ja_tem_rg: boolean;
}

/** I3: mostra o que vai casar com quem antes de mover qualquer byte de arquivo. */
async function previewDocumentos(cpfsCnpjs: string[], parceiroId?: string): Promise<PreviewDocumentoItem[]> {
  const limpos = [...new Set(cpfsCnpjs.map((c) => c.replace(/\D/g, '')).filter(Boolean))];
  if (limpos.length === 0) return [];

  const todosAssociados = await db().select().from(schema.associados).where(eq(schema.associados.tenantId, ABDCM_TENANT_ID));
  const porCpf = new Map(todosAssociados.map((a) => [a.cpfCnpjRaw, a]));

  const todosDocs = await db().select().from(schema.documentosAssociado).where(eq(schema.documentosAssociado.tenantId, ABDCM_TENANT_ID));
  const docsPorAssociado = new Map<string, Set<string>>();
  for (const d of todosDocs) {
    if (!docsPorAssociado.has(d.associadoId)) docsPorAssociado.set(d.associadoId, new Set());
    docsPorAssociado.get(d.associadoId)!.add(d.tipo);
  }

  return limpos.map((cpf) => {
    const associado = porCpf.get(cpf);
    if (!associado || (parceiroId && associado.parceiroId !== parceiroId)) {
      return { cpf_cnpj_raw: cpf, associado_id: null, nome: null, ja_tem_cnh: false, ja_tem_rg: false };
    }
    const docs = docsPorAssociado.get(associado.id) ?? new Set<string>();
    return {
      cpf_cnpj_raw: cpf,
      associado_id: associado.id,
      nome: associado.nome,
      ja_tem_cnh: docs.has('cnh'),
      ja_tem_rg: docs.has('rg'),
    };
  });
}

async function presignDocumentoUpload(
  associadoId: string,
  tipo: TipoDocumento,
  mimeType: string,
  parceiroId?: string,
): Promise<{ uploadUrl: string; key: string; headers?: Record<string, string> }> {
  if (!TIPOS_DOCUMENTO.includes(tipo)) throw new Error(`Tipo de documento inválido: ${tipo}.`);

  const [associado] = await db().select().from(schema.associados).where(eq(schema.associados.id, associadoId));
  if (!associado) throw new Error('Associado não encontrado.');
  if (parceiroId && associado.parceiroId !== parceiroId) {
    throw new Error('Este associado não pertence ao seu cadastro.');
  }

  const key = `documentos/${associado.tenantId}/${associadoId}/${tipo}.${extensaoPorMime(mimeType)}`;
  const { uploadUrl, headers } = await getStorageProvider().criarUrlUpload({
    key,
    contentType: mimeType,
    expiraEmSegundos: URL_STORAGE_EXPIRA_SEGUNDOS,
  });
  return { uploadUrl, key, headers };
}

async function confirmarDocumentoUpload(data: {
  associadoId: string;
  tipo: TipoDocumento;
  key: string;
  mimeType: string;
  nomeArquivo: string;
  tamanhoBytes?: number;
  atorUserId: string;
  parceiroId?: string;
}): Promise<void> {
  if (!TIPOS_DOCUMENTO.includes(data.tipo)) throw new Error(`Tipo de documento inválido: ${data.tipo}.`);

  const [associado] = await db().select().from(schema.associados).where(eq(schema.associados.id, data.associadoId));
  if (!associado) throw new Error('Associado não encontrado.');
  if (data.parceiroId && associado.parceiroId !== data.parceiroId) {
    throw new Error('Este associado não pertence ao seu cadastro.');
  }

  const providerNome = storageProviderConfigurado() ? 'r2' : 'mock';
  const now = new Date().toISOString();

  await db()
    .insert(schema.documentosAssociado)
    .values({
      id: novoId('doc'),
      tenantId: associado.tenantId,
      associadoId: data.associadoId,
      tipo: data.tipo,
      storageKey: data.key,
      storageProvider: providerNome,
      mimeType: data.mimeType,
      nomeArquivo: data.nomeArquivo,
      tamanhoBytes: data.tamanhoBytes ?? null,
      enviadoPorUserId: data.atorUserId,
      enviadoEm: now,
    })
    .onConflictDoUpdate({
      target: [schema.documentosAssociado.associadoId, schema.documentosAssociado.tipo],
      set: {
        storageKey: data.key,
        storageProvider: providerNome,
        mimeType: data.mimeType,
        nomeArquivo: data.nomeArquivo,
        tamanhoBytes: data.tamanhoBytes ?? null,
        enviadoPorUserId: data.atorUserId,
        enviadoEm: now,
      },
    });
}

type StatusDocumentosAssociado = Record<TipoDocumento, boolean>;

async function getDocumentosStatus(parceiroId?: string): Promise<Record<string, StatusDocumentosAssociado>> {
  const associados = parceiroId
    ? await db().select({ id: schema.associados.id }).from(schema.associados).where(eq(schema.associados.parceiroId, parceiroId))
    : await db().select({ id: schema.associados.id }).from(schema.associados);
  const idsValidos = new Set(associados.map((a) => a.id));

  const docs = await db().select().from(schema.documentosAssociado);
  const status: Record<string, StatusDocumentosAssociado> = {};
  for (const d of docs) {
    if (!idsValidos.has(d.associadoId)) continue;
    if (!status[d.associadoId]) {
      status[d.associadoId] = { cnh: false, rg: false, comprovante_inscricao: false, ficha_associativa: false };
    }
    if (TIPOS_DOCUMENTO.includes(d.tipo as TipoDocumento)) {
      status[d.associadoId][d.tipo as TipoDocumento] = true;
    }
  }
  return status;
}

/** Documento sensível — gera link de download temporário e registra quem baixou (I6-adjacente). */
async function getDocumentoDownloadUrl(
  associadoId: string,
  tipo: TipoDocumento,
  atorUserId: string,
  parceiroId?: string,
): Promise<string> {
  const [associado] = await db().select().from(schema.associados).where(eq(schema.associados.id, associadoId));
  if (!associado) throw new Error('Associado não encontrado.');
  if (parceiroId && associado.parceiroId !== parceiroId) {
    throw new Error('Este associado não pertence ao seu cadastro.');
  }
  const [doc] = await db()
    .select()
    .from(schema.documentosAssociado)
    .where(and(eq(schema.documentosAssociado.associadoId, associadoId), eq(schema.documentosAssociado.tipo, tipo)));
  if (!doc) throw new Error('Documento não encontrado.');

  await db().insert(schema.auditLog).values({
    id: novoId('audit'),
    tenantId: associado.tenantId,
    atorUserId,
    acao: 'DOWNLOAD_DOCUMENTO_ASSOCIADO',
    entidadeTipo: 'documentos_associado',
    entidadeId: doc.id,
    depois: { tipo, associado_id: associadoId },
    ip: '127.0.0.1',
    userAgent: 'ABDCM-Portal',
    ocorridoEm: new Date().toISOString(),
  });

  return getStorageProvider().criarUrlDownload(doc.storageKey, URL_STORAGE_EXPIRA_SEGUNDOS);
}

const URL_PACOTE_EXPIRA_SEGUNDOS = 7 * 24 * 60 * 60; // 7 dias — tempo pro jurídico baixar

export interface ResultadoEncerramentoLote {
  lote: Lote;
  totalNomes: number;
  pacoteUrl: string;
  whatsappEnviadoPara: number;
}

/** Monta a planilha (nome, CPF/CNPJ, protocolo, status, telefone) de todos os
 * registros do lote. Igual à revelação individual de CPF (I6), isto expõe o
 * documento sem máscara — é o próprio pacote que vai pro jurídico protocolar
 * junto aos birôs, então precisa do dado real; por isso fica registrado como
 * uma revelação em massa no audit_log (ver chamada em encerrarLote). */
async function montarPlanilhaLote(
  registrosDoLote: RegistroRow[],
  associadosPorId: Map<string, AssociadoRow>,
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Nomes');
  sheet.columns = [
    { header: 'Protocolo', key: 'protocolo', width: 20 },
    { header: 'Nome / Razão Social', key: 'nome', width: 32 },
    { header: 'CPF/CNPJ', key: 'cpfCnpj', width: 20 },
    { header: 'Telefone', key: 'telefone', width: 18 },
    { header: 'Status Processual', key: 'status', width: 20 },
    { header: 'Valor (R$)', key: 'valor', width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const reg of registrosDoLote) {
    const associado = associadosPorId.get(reg.associadoId);
    sheet.addRow({
      protocolo: reg.protocolCode || '—',
      nome: reg.nome,
      cpfCnpj: associado?.cpfCnpjRaw || reg.cpfCnpjRaw,
      telefone: associado?.telefoneWhatsapp || '—',
      status: reg.processStatus,
      valor: (reg.unitPrice / 100).toFixed(2).replace('.', ','),
    });
  }

  return workbook.xlsx.writeBuffer();
}

/** Encerra a captação de uma Ação Coletiva: bloqueia novos envios, gera o
 * pacote (planilha + documentos anexados dos associados, em um único ZIP) e
 * avisa a equipe ABDCM no WhatsApp (I1/I9 — só quem não é parceiro aciona;
 * validado antes, na rota). Ação manual (o admin confirma, não dispara
 * sozinho no instante em que o prazo vence) — I3: o preview de quantos nomes
 * entram no pacote é mostrado na tela antes de chamar isto. */
async function encerrarLote(loteId: string, atorUserId: string): Promise<ResultadoEncerramentoLote> {
  const [loteRow] = await db().select().from(schema.lotes).where(eq(schema.lotes.id, loteId));
  if (!loteRow) throw new Error('Ação Coletiva não encontrada.');
  if (loteRow.status !== 'aberto') {
    throw new Error('Só é possível encerrar uma Ação Coletiva que está com status "aberto".');
  }

  const registrosDoLote = await db().select().from(schema.registros).where(eq(schema.registros.loteId, loteId));

  const associadoIds = [...new Set(registrosDoLote.map((r) => r.associadoId))];
  const associadosDoLote =
    associadoIds.length > 0
      ? await db().select().from(schema.associados).where(inArray(schema.associados.id, associadoIds))
      : [];
  const associadosPorId = new Map(associadosDoLote.map((a) => [a.id, a]));

  const documentosDoLote =
    associadoIds.length > 0
      ? await db().select().from(schema.documentosAssociado).where(inArray(schema.documentosAssociado.associadoId, associadoIds))
      : [];

  // Monta o ZIP: planilha na raiz + uma pasta por associado com os
  // documentos que ele efetivamente anexou.
  const zip = new JSZip();
  const planilhaBuffer = await montarPlanilhaLote(registrosDoLote, associadosPorId);
  zip.file('planilha_nomes.xlsx', planilhaBuffer);

  for (const doc of documentosDoLote) {
    const associado = associadosPorId.get(doc.associadoId);
    const pastaAssociado = `documentos/${(associado?.nome || doc.associadoId).replace(/[^\w\s-]/g, '').trim() || doc.associadoId}`;
    try {
      const url = await getStorageProvider().criarUrlDownload(doc.storageKey, URL_STORAGE_EXPIRA_SEGUNDOS);
      const resposta = await fetch(resolverUrlAbsoluta(url));
      if (!resposta.ok) throw new Error(`status ${resposta.status}`);
      const bytes = await resposta.arrayBuffer();
      zip.file(`${pastaAssociado}/${doc.tipo}.${extensaoPorMime(doc.mimeType)}`, bytes);
    } catch (err) {
      console.error(`[encerrarLote] falha ao baixar documento ${doc.id} (${doc.tipo}) do associado ${doc.associadoId}:`, err);
      // Segue sem esse documento — o pacote sai incompleto nesse item em vez
      // de travar o encerramento inteiro por um arquivo com problema.
    }
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  const pacoteKey = `pacotes/${loteId}/pacote-${Date.now()}.zip`;
  const { uploadUrl, headers } = await getStorageProvider().criarUrlUpload({
    key: pacoteKey,
    contentType: 'application/zip',
    expiraEmSegundos: URL_STORAGE_EXPIRA_SEGUNDOS,
  });
  const uploadResp = await fetch(resolverUrlAbsoluta(uploadUrl), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/zip', ...headers },
    body: zipBuffer,
  });
  if (!uploadResp.ok) throw new Error('Falha ao enviar o pacote gerado para o storage.');
  const pacoteUrl = await getStorageProvider().criarUrlDownload(pacoteKey, URL_PACOTE_EXPIRA_SEGUNDOS);

  const agora = new Date().toISOString();
  await db().update(schema.lotes).set({ status: 'encerrado' }).where(eq(schema.lotes.id, loteId));

  await db().insert(schema.auditLog).values([
    {
      id: novoId('audit'),
      tenantId: loteRow.tenantId,
      atorUserId,
      acao: 'LOTE_ENCERRADO',
      entidadeTipo: 'lotes',
      entidadeId: loteId,
      antes: { status: loteRow.status },
      depois: { status: 'encerrado', total_nomes: registrosDoLote.length },
      ip: '127.0.0.1',
      userAgent: 'ABDCM-Admin-Console',
      ocorridoEm: agora,
    },
    {
      id: novoId('audit'),
      tenantId: loteRow.tenantId,
      atorUserId,
      acao: 'REVELACAO_EM_MASSA_PACOTE_LOTE',
      entidadeTipo: 'lotes',
      entidadeId: loteId,
      depois: { total_registros: registrosDoLote.length, total_documentos: documentosDoLote.length },
      ip: '127.0.0.1',
      userAgent: 'ABDCM-Admin-Console',
      ocorridoEm: agora,
    },
  ]);

  // Aviso por WhatsApp pra equipe ABDCM (números configurados em Automações)
  // — best-effort: se falhar ou não estiver configurado, o pacote já foi
  // gerado e continua acessível pela tela, então não derruba o encerramento.
  let whatsappEnviadoPara = 0;
  try {
    const [configLinha] = await db().select().from(schema.automacoesConfig).where(eq(schema.automacoesConfig.chave, 'lote_encerrado'));
    const numeros = Array.isArray(configLinha?.config?.numeros) ? (configLinha.config.numeros as string[]) : [];
    if ((configLinha?.ativo ?? true) && numeros.length > 0 && whatsAppProviderConfigurado()) {
      const mensagem =
        `Ação Coletiva ${loteRow.nome} encerrada! Foram ${registrosDoLote.length} nome(s) captado(s). ` +
        `Baixe a documentação completa aqui: ${pacoteUrl} (link válido por 7 dias)`;
      for (const telefone of numeros) {
        try {
          await getWhatsAppProvider().enviarTexto({ telefone, texto: mensagem });
          whatsappEnviadoPara += 1;
        } catch (err) {
          console.error(`[encerrarLote] falha ao enviar WhatsApp de encerramento para ${telefone}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('[encerrarLote] falha ao processar aviso de WhatsApp:', err);
  }

  return {
    lote: loteDeLinha({ ...loteRow, status: 'encerrado' }),
    totalNomes: registrosDoLote.length,
    pacoteUrl,
    whatsappEnviadoPara,
  };
}

export const serverStore = {
  getSession,
  setRole,
  getLotes,
  getAssociados,
  getRegistros,
  getSubmissoes,
  getProcessEvents,
  getAuditLogs,
  submitBatch,
  paySubmissao,
  approveSubmissao,
  reproveSubmissao,
  cancelSubmissao,
  addRegistro,
  deleteRegistro,
  transitionStatus,
  revealDocument,
  updateLote,
  createLote,
  encerrarLote,
  attachComprovante,
  getContestacoes,
  createContestacao,
  getServicos,
  createServico,
  updateServico,
  deleteServico,
  getContrato,
  setContrato,
  confirmarPagamentoPixWebhook,
  getPixCobrancaPorSubmissao,
  getAutomacoesConfig,
  setAutomacaoConfig,
  getNotificacoesLog,
  previewDocumentos,
  presignDocumentoUpload,
  confirmarDocumentoUpload,
  getDocumentosStatus,
  getDocumentoDownloadUrl,
};
