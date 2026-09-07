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
  Contestacao,
  Servico,
  Contrato,
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
type ContestacaoRow = typeof schema.contestacoes.$inferSelect;
type ServicoRow = typeof schema.servicos.$inferSelect;
type ContratoRow = typeof schema.contratos.$inferSelect;

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
  attachComprovante,
  getContestacoes,
  createContestacao,
  getServicos,
  createServico,
  updateServico,
  deleteServico,
  getContrato,
  setContrato,
};
