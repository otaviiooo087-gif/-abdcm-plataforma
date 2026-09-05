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

import { and, eq } from 'drizzle-orm';
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
} from '../domain/types.js';
import { ABDCM_TENANT_ID, SEED_USERS, type UserSession } from './mockData.js';

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
async function submitBatch(
  registroIds: string[],
  atorUserId: string,
): Promise<{ submissao: Submissao; registros: Registro[] }> {
  if (!registroIds || registroIds.length === 0) {
    throw new Error('Nenhum registro selecionado para envio.');
  }

  return db().transaction(async (tx) => {
    const [lote] = await tx.select().from(schema.lotes).where(eq(schema.lotes.id, 'lote-124'));
    const precoUnitario = lote?.precoPorNome ?? 25000;
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

      await tx
        .update(schema.registros)
        .set({ submissaoId, processStatus: 'enviado', isLocked: true, enviadoEm: now, updatedAt: now })
        .where(eq(schema.registros.id, regId));
      atualizados.push(registroDeLinha({ ...atual, submissaoId, processStatus: 'enviado', isLocked: true, enviadoEm: now, updatedAt: now }));

      await tx.insert(schema.processEvents).values({
        id: novoId('pe'),
        tenantId: atual.tenantId,
        registroId: atual.id,
        deStatus: atual.processStatus,
        paraStatus: 'enviado',
        atorTipo: 'parceiro',
        atorUserId,
        motivo: `Envio de lista (${registroIds.length} nomes) para Ação Coletiva 124`,
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
}

/** Confirma pagamento PIX da submissão (webhook / simulação). */
async function paySubmissao(
  submissaoId: string,
  atorUserId: string,
): Promise<{ submissao: Submissao; registros: Registro[] }> {
  return db().transaction(async (tx) => {
    const [sub] = await tx.select().from(schema.submissoes).where(eq(schema.submissoes.id, submissaoId));
    if (!sub) throw new Error(`Submissão ${submissaoId} não encontrada.`);

    const now = new Date().toISOString();
    await tx
      .update(schema.submissoes)
      .set({ paymentStatus: 'pago', confirmadoEm: now })
      .where(eq(schema.submissoes.id, submissaoId));

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

/** Cancela submissão pendente e libera os registros de volta para "pendente". */
async function cancelSubmissao(submissaoId: string, atorUserId: string): Promise<void> {
  await db().transaction(async (tx) => {
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
        atorTipo: 'admin',
        atorUserId,
        motivo: 'Cancelamento da submissão',
        metadata: { submissao_id: submissaoId },
        ocorridoEm: now,
      });
    }

    await tx.delete(schema.submissoes).where(eq(schema.submissoes.id, submissaoId));
  });
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
  const loteId = data.lote_id ?? 'lote-124';
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

  const novo = {
    id,
    tenantId: ABDCM_TENANT_ID,
    loteId,
    parceiroId: 'parc-001',
    associadoId: `assoc-${id}`,
    nome: data.nome.trim(),
    cpfCnpjRaw: limpo,
    cpfCnpj: data.cpf_cnpj.trim(),
    tipoDocumento: tipo,
    processStatus: 'pendente' as const,
    isLocked: false,
    unitPrice: 25000,
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
};
