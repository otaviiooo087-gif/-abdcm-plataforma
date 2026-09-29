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

import { createHash } from 'node:crypto';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
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
  EventoNoticia,
  RegistroOrgaoStatus,
  NadaConstaEmissao,
  OrgaoBureau,
  ConfiguracaoEmpresa,
  MarketingCronogramaDia,
  MarketingDisparo,
  MarketingGrupoConfig,
  MensagemExtra,
  ChamadaConfig,
  ChamadaLog,
  MovimentacaoProcesso,
  CredencialIntegracaoStatus,
  GastoApiPorProvider,
} from '../domain/types.js';
import { getLigacaoProvider } from '../integrations/ligacao/index.js';
import { ORGAOS_BUREAU } from '../domain/types.js';
import { getNadaConstaProvider } from '../integrations/nadaconsta/index.js';
import { ABDCM_TENANT_ID, SEED_USERS, type UserSession } from './mockData.js';
import { maskDocument, formatDocumentFull } from '../lib/masking/documentMasker.js';
import { getPixProvider, pixProviderConfigurado } from '../integrations/pix/index.js';
import { getStorageProvider, storageProviderConfigurado } from '../integrations/storage/index.js';
import { getWhatsAppProvider, whatsAppProviderConfigurado } from '../integrations/whatsapp/index.js';
import { getOcrProvider, ocrProviderConfigurado } from '../integrations/ocr/index.js';
import { gerarFichaAssociativaPdf } from '../domain/associados/ficha.js';
import { emitirEvento } from './eventBus.js';
import { getMonitoramentoProvider, monitoramentoProviderConfigurado } from '../integrations/monitoramento/index.js';
import { getBureauProvider, bureauProviderConfigurado } from '../integrations/bureau/index.js';
import { CATALOGO_INTEGRACOES, definicaoIntegracao } from '../integrations/credenciaisCatalogo.js';
import { criptografarValores, descriptografarValores } from './security/credentialsCrypto.js';
import { definirCredencialCache } from './security/credentialsCache.js';
import { hashPassword, verifyPassword } from './auth/password.js';
import { criarTokenSessao } from './auth/session.js';
import { sessaoRealAtual } from './auth/context.js';

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
type EventoNoticiaRow = typeof schema.eventosNoticias.$inferSelect;
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
    judit_tracking_id: l.juditTrackingId,
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

function movimentacaoProcessoDeLinha(m: typeof schema.processoMovimentacoes.$inferSelect): MovimentacaoProcesso {
  return {
    id: m.id,
    tenant_id: m.tenantId,
    lote_id: m.loteId,
    descricao: m.descricao,
    ocorrido_em: m.ocorridoEm,
    fonte: m.fonte,
    origem: m.origem as MovimentacaoProcesso['origem'],
    criado_em: m.criadoEm,
  };
}

function servicoDeLinha(s: ServicoRow): Servico {
  return {
    id: s.id,
    tenant_id: s.tenantId,
    nome: s.nome,
    descricao: s.descricao,
    preco: s.preco,
    custo: s.custo,
    prazo_dias: s.prazoDias,
    usa_listas: s.usaListas,
    ativo: s.ativo,
    foto_url: s.fotoUrl,
    link_redirecionamento: s.linkRedirecionamento,
    created_at: s.createdAt,
  };
}

function eventoNoticiaDeLinha(e: EventoNoticiaRow): EventoNoticia {
  return {
    id: e.id,
    tenant_id: e.tenantId,
    tipo: e.tipo as EventoNoticia['tipo'],
    titulo: e.titulo,
    descricao: e.descricao,
    categoria: e.categoria,
    imagem_url: e.imagemUrl,
    link_externo: e.linkExterno,
    data_evento: e.dataEvento,
    ativo: e.ativo,
    criado_por_user_id: e.criadoPorUserId,
    created_at: e.createdAt,
  };
}

function contratoDeLinha(c: ContratoRow): Contrato {
  return {
    id: c.id,
    tenant_id: c.tenantId,
    titulo: c.titulo,
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

/**
 * Sessão real (cookie assinado, resolvida em authContext no server.ts) tem
 * precedência sobre o `activeUser` de demonstração. Sem cookie válido (ou
 * pra quem ainda não tem conta real), cai no comportamento de sempre.
 */
function getSession(): UserSession {
  return sessaoRealAtual() ?? activeUser;
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
// Login real (parceiro e administrador) — contas com senha, tabela
// `usuarios`. Os outros 4 papéis continuam só na troca de papel acima.
// ---------------------------------------------------------------------

type UsuarioRow = typeof schema.usuarios.$inferSelect;

function usuarioParaSessao(u: UsuarioRow): UserSession {
  return {
    id: u.id,
    tenant_id: u.tenantId,
    nome: u.nome,
    email: u.email,
    role: u.role as UserRole,
    parceiro_id: u.parceiroId ?? undefined,
    partner_code: u.partnerCode ?? undefined,
    autenticado: true,
  };
}

async function buscarUsuarioPorId(id: string): Promise<UserSession | null> {
  const [row] = await db().select().from(schema.usuarios).where(eq(schema.usuarios.id, id)).limit(1);
  if (!row || !row.ativo) return null;
  return usuarioParaSessao(row);
}

/** Lista de contas de login reais (parceiro/administrador) — Controle de Acesso. */
async function listarUsuarios(): Promise<
  { id: string; nome: string; email: string; role: UserRole; parceiro_id: string | null; ativo: boolean; created_at: string }[]
> {
  const linhas = await db()
    .select()
    .from(schema.usuarios)
    .where(eq(schema.usuarios.tenantId, ABDCM_TENANT_ID))
    .orderBy(desc(schema.usuarios.createdAt));
  return linhas.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    role: u.role as UserRole,
    parceiro_id: u.parceiroId,
    ativo: u.ativo,
    created_at: u.createdAt,
  }));
}

/** Ativa/desativa uma conta de login (revoga acesso sem apagar o histórico). */
async function setUsuarioAtivo(usuarioId: string, ativo: boolean, atorUserId: string): Promise<void> {
  const [atual] = await db().select().from(schema.usuarios).where(eq(schema.usuarios.id, usuarioId));
  if (!atual) throw new Error('Conta não encontrada.');

  await db().update(schema.usuarios).set({ ativo }).where(eq(schema.usuarios.id, usuarioId));

  await db().insert(schema.auditLog).values({
    id: novoId('audit'),
    tenantId: atual.tenantId,
    atorUserId,
    acao: ativo ? 'CONTA_REATIVADA' : 'CONTA_DESATIVADA',
    entidadeTipo: 'usuarios',
    entidadeId: usuarioId,
    antes: { ativo: atual.ativo },
    depois: { ativo },
    ip: '127.0.0.1',
    userAgent: 'ABDCM-Admin-Console',
    ocorridoEm: new Date().toISOString(),
  });
}

async function autenticarUsuario(
  email: string,
  senha: string,
): Promise<{ sessao: UserSession; token: string } | { erro: string }> {
  const emailNormalizado = email.trim().toLowerCase();
  if (!emailNormalizado || !senha) return { erro: 'E-mail e senha são obrigatórios.' };

  const linhas = await db().select().from(schema.usuarios).where(eq(schema.usuarios.tenantId, ABDCM_TENANT_ID));
  const row = linhas.find((u) => u.email.toLowerCase() === emailNormalizado);

  // Mensagem genérica em qualquer caso de falha — não revela se o e-mail existe.
  if (!row || !row.ativo || !verifyPassword(senha, row.senhaHash)) {
    return { erro: 'E-mail ou senha inválidos.' };
  }

  const sessao = usuarioParaSessao(row);
  const token = criarTokenSessao(row.id);
  return { sessao, token };
}

async function registrarParceiro(input: {
  nome: string;
  email: string;
  senha: string;
}): Promise<{ sessao: UserSession; token: string } | { erro: string }> {
  const nome = input.nome.trim();
  const email = input.email.trim().toLowerCase();
  const senha = input.senha;

  if (!nome) return { erro: 'Informe o nome ou razão social.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: 'E-mail inválido.' };
  if (senha.length < 8) return { erro: 'A senha precisa ter pelo menos 8 caracteres.' };

  const existentes = await db().select().from(schema.usuarios).where(eq(schema.usuarios.tenantId, ABDCM_TENANT_ID));
  if (existentes.some((u) => u.email.toLowerCase() === email)) {
    return { erro: 'Já existe uma conta com este e-mail.' };
  }

  const id = novoId('usr-parceiro');
  const parceiroId = novoId('parc');
  const partnerCode = `PARC-${id.slice(-8).toUpperCase()}`;
  const now = new Date().toISOString();

  const [row] = await db()
    .insert(schema.usuarios)
    .values({
      id,
      tenantId: ABDCM_TENANT_ID,
      nome,
      email,
      senhaHash: hashPassword(senha),
      role: 'parceiro',
      parceiroId,
      partnerCode,
      ativo: true,
      createdAt: now,
    })
    .returning();

  await db().insert(schema.auditLog).values({
    id: novoId('audit'),
    tenantId: ABDCM_TENANT_ID,
    atorUserId: id,
    acao: 'PARCEIRO_CADASTRADO',
    entidadeTipo: 'usuarios',
    entidadeId: id,
    depois: { nome, email, parceiro_id: parceiroId },
    ip: '127.0.0.1',
    userAgent: 'ABDCM-Cadastro-Parceiro',
    ocorridoEm: now,
  });

  const sessao = usuarioParaSessao(row!);
  const token = criarTokenSessao(row!.id);
  return { sessao, token };
}

async function alterarSenha(
  usuarioId: string,
  senhaAtual: string,
  novaSenha: string,
): Promise<{ ok: true } | { erro: string }> {
  if (novaSenha.length < 8) return { erro: 'A nova senha precisa ter pelo menos 8 caracteres.' };

  const [row] = await db().select().from(schema.usuarios).where(eq(schema.usuarios.id, usuarioId)).limit(1);
  if (!row || !row.ativo) return { erro: 'Conta não encontrada.' };
  if (!verifyPassword(senhaAtual, row.senhaHash)) return { erro: 'Senha atual incorreta.' };

  await db().update(schema.usuarios).set({ senhaHash: hashPassword(novaSenha) }).where(eq(schema.usuarios.id, usuarioId));

  await db().insert(schema.auditLog).values({
    id: novoId('audit'),
    tenantId: row.tenantId,
    atorUserId: usuarioId,
    acao: 'SENHA_ALTERADA',
    entidadeTipo: 'usuarios',
    entidadeId: usuarioId,
    ip: '127.0.0.1',
    userAgent: 'ABDCM-Meu-Perfil',
    ocorridoEm: new Date().toISOString(),
  });

  return { ok: true };
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

/** Métricas extras do Dashboard — tudo calculado de dado real (nada
 * inventado): parceiros novos, ranking de parceiros por volume enviado, e
 * ranking de lotes/Ações Coletivas por volume (o "ranking de serviços"
 * pedido — hoje só a Ação Limpa Nome tem venda de verdade rastreada; o
 * catálogo de Serviços ainda não tem fluxo de compra próprio). */
async function getDashboardExtra(): Promise<{
  parceirosNovos30dias: number;
  parceirosTotal: number;
  rankingParceiros: { parceiro_id: string; nome: string; nomes_enviados: number; valor_pago: number }[];
  rankingLotes: { lote_id: string; nome: string; nomes_enviados: number; valor_pago: number }[];
}> {
  const usuariosParceiro = await db()
    .select()
    .from(schema.usuarios)
    .where(and(eq(schema.usuarios.tenantId, ABDCM_TENANT_ID), eq(schema.usuarios.role, 'parceiro')));

  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const parceirosNovos30dias = usuariosParceiro.filter((u) => new Date(u.createdAt) >= trintaDiasAtras).length;

  const nomeParceiro = new Map<string, string>();
  for (const u of usuariosParceiro) if (u.parceiroId) nomeParceiro.set(u.parceiroId, u.nome);
  for (const s of SEED_USERS) {
    if (s.role === 'parceiro' && s.parceiro_id && !nomeParceiro.has(s.parceiro_id)) {
      nomeParceiro.set(s.parceiro_id, s.nome);
    }
  }

  const todosRegistros = await db().select().from(schema.registros);
  const todasSubmissoes = await db().select().from(schema.submissoes);
  const enviadoOuAlem = new Set(['enviado', 'aguardando_pagamento', 'pago', 'aguardando_protocolo', 'protocolado', 'baixado', 'recusado']);

  const porParceiro = new Map<string, { nomes: number; valor: number }>();
  const porLote = new Map<string, { nomes: number; valor: number }>();
  for (const r of todosRegistros) {
    if (!enviadoOuAlem.has(r.processStatus)) continue;
    const p = porParceiro.get(r.parceiroId) ?? { nomes: 0, valor: 0 };
    p.nomes += 1;
    porParceiro.set(r.parceiroId, p);
    const l = porLote.get(r.loteId) ?? { nomes: 0, valor: 0 };
    l.nomes += 1;
    porLote.set(r.loteId, l);
  }
  for (const s of todasSubmissoes) {
    if (s.paymentStatus !== 'pago') continue;
    const p = porParceiro.get(s.parceiroId) ?? { nomes: 0, valor: 0 };
    p.valor += s.valorTotal;
    porParceiro.set(s.parceiroId, p);
    const l = porLote.get(s.loteId) ?? { nomes: 0, valor: 0 };
    l.valor += s.valorTotal;
    porLote.set(s.loteId, l);
  }

  const rankingParceiros = [...porParceiro.entries()]
    .map(([parceiro_id, v]) => ({
      parceiro_id,
      nome: nomeParceiro.get(parceiro_id) || `Parceiro ${parceiro_id.slice(0, 12)}`,
      nomes_enviados: v.nomes,
      valor_pago: v.valor,
    }))
    .sort((a, b) => b.nomes_enviados - a.nomes_enviados);

  const lotesRows = await db().select({ id: schema.lotes.id, nome: schema.lotes.nome }).from(schema.lotes);
  const nomeLote = new Map(lotesRows.map((l) => [l.id, l.nome]));
  const rankingLotes = [...porLote.entries()]
    .map(([lote_id, v]) => ({ lote_id, nome: nomeLote.get(lote_id) || lote_id, nomes_enviados: v.nomes, valor_pago: v.valor }))
    .sort((a, b) => b.valor_pago - a.valor_pago);

  const parceirosTotal = new Set([...nomeParceiro.keys(), ...porParceiro.keys()]).size;

  return { parceirosNovos30dias, parceirosTotal, rankingParceiros, rankingLotes };
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
  await registrarCustoApi('pix_asaas', 'criar_cobranca', submissao.id);

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
      parceiroId: getSession().parceiro_id || 'parc-001',
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

  emitirEvento({ categoria: 'registros', parceiroId: submissao.parceiro_id });
  emitirEvento({ categoria: 'submissoes', parceiroId: submissao.parceiro_id });
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
    const submissaoFinal = submissaoDeLinha(submissaoRow!);
    return { submissao: submissaoFinal, registros: atualizados };
  }).then((resultado) => {
    emitirEvento({ categoria: 'submissoes', parceiroId: resultado.submissao.parceiro_id });
    emitirEvento({
      categoria: 'registros',
      parceiroId: resultado.submissao.parceiro_id,
      notificacao: { titulo: 'Pagamento confirmado', mensagem: `${resultado.registros.length} nome(s) da AÇÃO COLETIVA foram pagos e seguem pro protocolo.` },
    });
    return resultado;
  });
}

/**
 * Recebe o webhook do provedor de PIX, valida e — se for confirmação de
 * pagamento — casa com a cobrança pelo txid e chama paySubmissao (que já é
 * idempotente). Webhook fora de ordem ou de uma cobrança não confirmada
 * (pendente/expirado) não altera nada. Uma cobrança que já tinha sido
 * marcada expirada/cancelada (ver marcarPixExpirado) e recebe um "pago"
 * atrasado NÃO confirma sozinha — cai na fila de conciliação pra um humano
 * decidir, exatamente como um comprovante divergente (I3/I11).
 */
async function confirmarPagamentoPixWebhook(
  payload: unknown,
  headers: Record<string, string | string[] | undefined>,
): Promise<{ submissao: Submissao; registros: Registro[] } | null> {
  const evento = await getPixProvider().validarWebhook(payload, headers);
  if (evento.status !== 'pago') return null;

  const [cobranca] = await db().select().from(schema.pixCobrancas).where(eq(schema.pixCobrancas.txid, evento.txid));
  if (!cobranca) throw new Error(`Cobrança PIX com txid "${evento.txid}" não encontrada.`);

  if (cobranca.status === 'expirado' || cobranca.status === 'cancelado') {
    await registrarDivergenciaPagamento(
      cobranca.submissaoId,
      'webhook_pix',
      `Webhook de pagamento confirmado chegou depois da cobrança já estar "${cobranca.status}" — requer conferência manual antes de liberar.`,
    );
    return null;
  }

  return paySubmissao(cobranca.submissaoId, 'system-pix');
}

/** Marca uma cobrança PIX (e a submissão, se ainda estiver pendente — outro
 * caminho pode ter confirmado o pagamento enquanto isso) como expirada ou
 * cancelada. Depois disso a cobrança sai do radar de reconciliarPixPendentes
 * (só olha status='pendente') — se um pagamento chegar depois, cai em
 * registrarDivergenciaPagamento, nunca confirma sozinho. */
async function marcarPixExpirado(cobrancaId: string, submissaoId: string, status: 'expirado' | 'cancelado'): Promise<void> {
  await db().update(schema.pixCobrancas).set({ status }).where(eq(schema.pixCobrancas.id, cobrancaId));
  const [atualizada] = await db()
    .update(schema.submissoes)
    .set({ paymentStatus: status === 'cancelado' ? 'cancelado' : 'expirado' })
    .where(and(eq(schema.submissoes.id, submissaoId), eq(schema.submissoes.paymentStatus, 'pendente')))
    .returning({ parceiroId: schema.submissoes.parceiroId });
  if (atualizada) emitirEvento({ categoria: 'submissoes', parceiroId: atualizada.parceiroId });
}

/** Pagamento chegou (via webhook ou reconciliação) pra uma submissão cuja
 * cobrança já não estava mais pendente (expirou ou foi cancelada) — em vez
 * de confirmar sozinho, volta pra fila de conciliação (paymentStatus
 * "pendente" de novo, registros em "aguardando_pagamento") com o motivo
 * registrado, pra um humano decidir (I3: sem confirmação automática de
 * dinheiro fora do fluxo esperado). Idempotente: se a submissão já foi paga
 * por outro caminho enquanto isso, não reabre nada. */
async function registrarDivergenciaPagamento(submissaoId: string, origem: string, motivo: string): Promise<void> {
  const resultado = await db().transaction(async (tx) => {
    const [sub] = await tx.select().from(schema.submissoes).where(eq(schema.submissoes.id, submissaoId));
    if (!sub || sub.paymentStatus === 'pago') return null;

    const now = new Date().toISOString();
    await tx
      .update(schema.submissoes)
      .set({ paymentStatus: 'pendente', motivoObservacao: motivo })
      .where(eq(schema.submissoes.id, submissaoId));

    const afetados = await tx
      .select()
      .from(schema.registros)
      .where(and(eq(schema.registros.submissaoId, submissaoId), eq(schema.registros.processStatus, 'enviado')));

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
        atorTipo: 'system',
        atorUserId: 'system-pix-reconciliacao',
        motivo,
        metadata: { submissao_id: submissaoId, origem },
        ocorridoEm: now,
      });
    }

    await tx.insert(schema.auditLog).values({
      id: novoId('audit'),
      tenantId: sub.tenantId,
      atorUserId: 'system-pix-reconciliacao',
      acao: 'PIX_DIVERGENTE_POS_EXPIRACAO',
      entidadeTipo: 'submissoes',
      entidadeId: submissaoId,
      depois: { motivo, origem },
      ip: '127.0.0.1',
      userAgent: 'ABDCM-Reconciliacao-PIX',
      ocorridoEm: now,
    });

    return sub.parceiroId;
  });

  if (resultado) {
    emitirEvento({
      categoria: 'submissoes',
      parceiroId: resultado,
      notificacao: { titulo: 'Pagamento fora do prazo', mensagem: 'Um PIX pago depois do vencimento caiu na fila de conciliação pra conferência manual.' },
    });
  }
}

export interface ResultadoReconciliacaoPix {
  verificadas: number;
  confirmadas: number;
  expiradas: number;
}

/** Consulta ativamente o provedor de PIX pra cada cobrança ainda pendente,
 * em vez de esperar só pelo webhook — cobre o caso de webhook perdido/atrasado
 * e resolve cobranças que passaram do prazo sem confirmação. Roda em
 * intervalo curto (ver server.ts) porque é isso que faz o QR Code virar
 * "pago" na tela do parceiro sem precisar do webhook chegar. Idempotente e
 * seguro de rodar em paralelo com o webhook — paySubmissao já lida com
 * dupla confirmação. */
async function reconciliarPixPendentes(): Promise<ResultadoReconciliacaoPix> {
  const provider = getPixProvider();
  const pendentes = await db().select().from(schema.pixCobrancas).where(eq(schema.pixCobrancas.status, 'pendente'));
  const agora = new Date();
  let confirmadas = 0;
  let expiradas = 0;

  for (const cobranca of pendentes) {
    try {
      const passouDoPrazo = new Date(cobranca.expiraEm) < agora;
      const status = passouDoPrazo ? 'expirado' : await provider.consultarCobranca(cobranca.txid);

      if (status === 'pago') {
        await paySubmissao(cobranca.submissaoId, 'system-pix-reconciliacao');
        confirmadas++;
      } else if (status === 'expirado' || status === 'cancelado') {
        await marcarPixExpirado(cobranca.id, cobranca.submissaoId, status);
        expiradas++;
      }
      // 'pendente' — nada muda, tenta de novo na próxima rodada.
    } catch (err) {
      console.error(`[reconciliarPixPendentes] falha ao verificar cobrança ${cobranca.id}:`, err);
    }
  }

  return { verificadas: pendentes.length, confirmadas, expiradas };
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
  }).then((resultado) => {
    emitirEvento({ categoria: 'submissoes', parceiroId: resultado.submissao.parceiro_id });
    emitirEvento({ categoria: 'registros', parceiroId: resultado.submissao.parceiro_id });
    return resultado;
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
  }).then((submissao) => {
    emitirEvento({ categoria: 'submissoes', parceiroId: submissao.parceiro_id });
    emitirEvento({ categoria: 'registros', parceiroId: submissao.parceiro_id });
    return submissao;
  });
}

/** Comprovante de pagamento de uma submissão — só quem pode ver a
 * submissão (o próprio parceiro dono, ou a equipe ABDCM) chega até aqui;
 * a checagem de quem pode chamar isto é feita na rota (server.ts). */
async function getComprovante(
  submissaoId: string,
): Promise<{ parceiroId: string; comprovanteBase64: string; mimeType: string } | null> {
  const [sub] = await db().select().from(schema.submissoes).where(eq(schema.submissoes.id, submissaoId));
  if (!sub || !sub.comprovanteBase64) return null;
  return {
    parceiroId: sub.parceiroId,
    comprovanteBase64: sub.comprovanteBase64,
    mimeType: sub.comprovanteMime || 'application/octet-stream',
  };
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
    return submissao.parceiroId;
  }).then((parceiroId) => {
    emitirEvento({ categoria: 'submissoes', parceiroId });
    emitirEvento({ categoria: 'registros', parceiroId });
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
  // Dono real do cadastro: o parceiro da sessão atual (login real ou troca
  // de papel de demonstração) — nunca um id fixo, senão nomes cadastrados
  // por um parceiro logado de verdade ficam invisíveis pra ele mesmo depois
  // (GET /api/registros filtra por session.parceiro_id pra quem é parceiro).
  const parceiroId = getSession().parceiro_id || 'parc-001';
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
  // Associado é entidade de primeira classe, independente do registro/lote —
  // reaproveita o mesmo associado se o CPF já existir (evita fragmentar
  // documentos/consentimento em ids diferentes pra mesma pessoa) e cria um
  // novo, sempre real (nunca um id fabricado), caso contrário. Telefone é
  // opcional: sem ele o bot de WhatsApp (I7) simplesmente não funciona pra
  // essa pessoa até alguém completar o cadastro depois.
  const [associadoExistente] = await db()
    .select()
    .from(schema.associados)
    .where(and(eq(schema.associados.tenantId, ABDCM_TENANT_ID), eq(schema.associados.cpfCnpjRaw, limpo)));

  let associadoId: string;
  if (associadoExistente) {
    associadoId = associadoExistente.id;
    if (data.telefone_whatsapp && !associadoExistente.telefoneWhatsapp) {
      await db()
        .update(schema.associados)
        .set({ telefoneWhatsapp: data.telefone_whatsapp.trim() })
        .where(eq(schema.associados.id, associadoId));
    }
  } else {
    associadoId = novoId('assoc');
    await db().insert(schema.associados).values({
      id: associadoId,
      tenantId: ABDCM_TENANT_ID,
      parceiroId,
      nome: data.nome.trim(),
      cpfCnpjRaw: limpo,
      cpfCnpj: maskDocument(limpo),
      tipoDocumento: tipo,
      telefoneWhatsapp: data.telefone_whatsapp?.trim() || null,
      statusFiliacao: 'pre_cadastro',
      createdAt: now,
    });
  }

  const novo = {
    id,
    tenantId: ABDCM_TENANT_ID,
    loteId,
    parceiroId,
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

// ---------------------------------------------------------------------
// Importação de planilha (Nome + CPF/CNPJ), com anexo opcional de
// documentos (CNH/RG/ficha associativa) casados por CPF via OCR.
// ---------------------------------------------------------------------

export interface LinhaImportacao {
  nome: string;
  cpfCnpj: string;
  status: 'ok' | 'error';
  erro?: string;
}

/** Parser de linha CSV simples respeitando aspas — suficiente pro modelo de
 * Nome + CPF/CNPJ que a própria plataforma gera pro parceiro baixar. */
function parseLinhaCsv(linha: string): string[] {
  const campos: string[] = [];
  let atual = '';
  let dentroDeAspas = false;
  for (const c of linha) {
    if (c === '"') {
      dentroDeAspas = !dentroDeAspas;
    } else if (c === ',' && !dentroDeAspas) {
      campos.push(atual);
      atual = '';
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos;
}

/** Baixa a planilha já enviada pro storage (presignStagingUpload) e lê as
 * linhas — nunca escreve nada no banco (I3: preview não escreve nada).
 * Linha 1 é sempre cabeçalho, ignorada. CPF/CNPJ inválido ou duplicado
 * dentro do próprio arquivo vira status 'error', mas a linha aparece do
 * mesmo jeito pra conferência — planilha malformada não quebra a
 * importação inteira, só as linhas ruins ficam marcadas. */
async function parseArquivoImportacao(
  key: string,
  mimeType: string,
  nomeArquivo: string,
): Promise<{ linhas: LinhaImportacao[]; ignoradas: number }> {
  const url = resolverUrlAbsoluta(await getStorageProvider().criarUrlDownload(key, URL_STORAGE_EXPIRA_SEGUNDOS));
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`Falha ao baixar a planilha (status ${resposta.status}).`);
  const bytes = await resposta.arrayBuffer();

  const linhasBrutas: string[][] = [];
  const ehCsv = mimeType === 'text/csv' || nomeArquivo.toLowerCase().endsWith('.csv');

  if (ehCsv) {
    const texto = Buffer.from(bytes).toString('utf8');
    for (const linha of texto.split(/\r?\n/)) {
      if (linha.trim()) linhasBrutas.push(parseLinhaCsv(linha));
    }
  } else {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(bytes));
      const planilha = workbook.worksheets[0];
      if (!planilha) throw new Error('sem abas');
      planilha.eachRow((row) => {
        const valores = (row.values as unknown[]).slice(1);
        linhasBrutas.push(valores.map((v) => (v == null ? '' : String(v).trim())));
      });
    } catch {
      throw new Error('Não conseguimos ler esse arquivo. Envie em .xlsx ou .csv.');
    }
  }

  if (linhasBrutas.length === 0) return { linhas: [], ignoradas: 0 };

  // Linha 1 é cabeçalho, sempre ignorada (formato já documentado na tela).
  const dados = linhasBrutas.slice(1);
  let ignoradas = 0;
  const vistos = new Set<string>();
  const linhas: LinhaImportacao[] = [];

  for (const cols of dados) {
    const nome = (cols[0] || '').trim();
    const cpfCnpjBruto = (cols[1] || '').trim();
    if (!nome && !cpfCnpjBruto) {
      ignoradas++;
      continue;
    }
    const cpfCnpj = cpfCnpjBruto.replace(/\D/g, '');
    if (!nome) {
      linhas.push({ nome: '(sem nome)', cpfCnpj, status: 'error', erro: 'Nome vazio.' });
      continue;
    }
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
      linhas.push({ nome, cpfCnpj, status: 'error', erro: 'CPF/CNPJ inválido.' });
      continue;
    }
    if (vistos.has(cpfCnpj)) {
      linhas.push({ nome, cpfCnpj, status: 'error', erro: 'CPF/CNPJ duplicado nesta planilha.' });
      continue;
    }
    vistos.add(cpfCnpj);
    linhas.push({ nome, cpfCnpj, status: 'ok' });
  }

  return { linhas, ignoradas };
}

export interface ImportOcrPreviewItem {
  key: string;
  nomeArquivo: string;
  tipoDetectado: 'cnh' | 'rg' | 'ficha_associativa' | null;
  ocrNome: string | null;
  ocrCpf: string | null;
  confianca: 'alta' | 'baixa';
  /** CPF/CNPJ (normalizado) de uma linha da planilha sendo importada que
   * bateu com o CPF lido — null quando não bateu com nenhuma linha. */
  linhaCpfCnpjSugerida: string | null;
  autoConfirmavel: boolean;
}

/** Igual a lerDocumentosOcr, mas casa o CPF lido contra as linhas da
 * planilha sendo importada agora — essas pessoas ainda não são associados
 * no banco, então a conferência é contra o lote em memória, não contra a
 * base (I3: nada é gravado aqui). */
async function lerDocumentosOcrParaImportacao(
  itens: { key: string; mimeType: string; nomeArquivo: string }[],
  linhas: { nome: string; cpfCnpj: string }[],
): Promise<ImportOcrPreviewItem[]> {
  const porCpf = new Map(linhas.map((l) => [l.cpfCnpj, l]));
  const ocr = getOcrProvider();

  return Promise.all(
    itens.map(async (item) => {
      const documentoUrl = resolverUrlAbsoluta(await getStorageProvider().criarUrlDownload(item.key, URL_STORAGE_EXPIRA_SEGUNDOS));
      const lido = await ocr.lerDocumento({ documentoUrl, mimeType: item.mimeType });
      const linha = lido.cpf ? porCpf.get(lido.cpf) : undefined;

      return {
        key: item.key,
        nomeArquivo: item.nomeArquivo,
        tipoDetectado: lido.tipoDocumento,
        ocrNome: lido.nome,
        ocrCpf: lido.cpf,
        confianca: lido.confianca,
        linhaCpfCnpjSugerida: linha?.cpfCnpj ?? null,
        autoConfirmavel: lido.confianca === 'alta' && Boolean(linha) && lido.tipoDocumento !== null,
      };
    }),
  );
}

/** Ficha associativa anexada (por importação em planilha ou gerada
 * automaticamente a partir de um documento) conta como filiação assinada
 * (I5): grava consentimento com data, IP de quem enviou e hash do arquivo,
 * e audita a transição de status. `fichaDocumentoId` no Associado guarda a
 * storage key da ficha (não o id da linha em documentos_associado) — é o
 * que já dá pra baixar direto via StorageProvider.criarUrlDownload. */
async function marcarFichaAssinadaPorImportacao(
  associadoId: string,
  fichaKey: string,
  atorUserId: string,
  opcoes?: { ip?: string; acao?: string; userAgent?: string },
): Promise<void> {
  const [atual] = await db().select().from(schema.associados).where(eq(schema.associados.id, associadoId));
  if (!atual) return;

  let hash: string | null = null;
  try {
    const url = resolverUrlAbsoluta(await getStorageProvider().criarUrlDownload(fichaKey, URL_STORAGE_EXPIRA_SEGUNDOS));
    const resposta = await fetch(url);
    if (resposta.ok) {
      const bytes = await resposta.arrayBuffer();
      hash = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
    }
  } catch (err) {
    console.error(`[marcarFichaAssinadaPorImportacao] falha ao calcular hash da ficha de ${associadoId}:`, err);
  }

  const ip = opcoes?.ip ?? '127.0.0.1';
  const now = new Date().toISOString();
  await db()
    .update(schema.associados)
    .set({
      statusFiliacao: 'ficha_assinada',
      consentimentoEm: now,
      consentimentoIp: ip,
      consentimentoHash: hash,
      fichaDocumentoId: fichaKey,
    })
    .where(eq(schema.associados.id, associadoId));

  await db().insert(schema.auditLog).values({
    id: novoId('audit'),
    tenantId: atual.tenantId,
    atorUserId,
    acao: opcoes?.acao ?? 'ASSOCIADO_FICHA_ASSINADA_IMPORTACAO',
    entidadeTipo: 'associados',
    entidadeId: associadoId,
    antes: { statusFiliacao: atual.statusFiliacao },
    depois: { statusFiliacao: 'ficha_assinada', consentimentoHash: hash },
    ip,
    userAgent: opcoes?.userAgent ?? 'ABDCM-Partner-Portal',
    ocorridoEm: now,
  });
}

export interface DocumentoParaImportar {
  tipo: 'cnh' | 'rg' | 'ficha_associativa';
  key: string;
  mimeType: string;
  nomeArquivo: string;
}

export interface ItemParaImportar {
  nome: string;
  cpf_cnpj: string;
  documentos?: DocumentoParaImportar[];
}

/** Importa as linhas confirmadas pelo parceiro, criando (ou reaproveitando,
 * por CPF) o associado de cada uma e anexando os documentos já casados —
 * cada anexo é best-effort: uma falha isolada não derruba a importação
 * inteira, só fica de fora do relatório de sucesso. */
async function importarRegistros(itens: ItemParaImportar[], atorUserId: string): Promise<Registro[]> {
  const importados: Registro[] = [];
  for (const item of itens) {
    const registro = await addRegistro({ nome: item.nome, cpf_cnpj: item.cpf_cnpj, origem: 'planilha' });
    importados.push(registro);

    if (!item.documentos || item.documentos.length === 0) continue;

    for (const doc of item.documentos) {
      try {
        await confirmarDocumentoUpload({
          associadoId: registro.associado_id,
          tipo: doc.tipo,
          key: doc.key,
          mimeType: doc.mimeType,
          nomeArquivo: doc.nomeArquivo,
          atorUserId,
        });
      } catch (err) {
        console.error(`[importarRegistros] falha ao anexar ${doc.tipo} do registro ${registro.id}:`, err);
      }
    }

    const ficha = item.documentos.find((d) => d.tipo === 'ficha_associativa');
    if (ficha) {
      await marcarFichaAssinadaPorImportacao(registro.associado_id, ficha.key, atorUserId);
    }
  }
  return importados;
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

    // Ao protocolar, cria a linha de status pendente pra cada órgão (I3: é
    // detalhe suplementar do registro, não um 9º ProcessStatus) — só uma vez,
    // então não recria se o registro já passou por aqui antes (ex.: reprotocolo).
    if (novoStatus === 'protocolado') {
      const existentes = await tx.select().from(schema.registroOrgaos).where(eq(schema.registroOrgaos.registroId, registroId));
      if (existentes.length === 0) {
        await tx.insert(schema.registroOrgaos).values(
          ORGAOS_BUREAU.map((orgao) => ({
            id: novoId('rorg'),
            tenantId: atual.tenantId,
            registroId,
            orgao,
            status: 'pendente',
            createdAt: now,
          })),
        );
      }
    }

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
  }).then((resultado) => {
    emitirEvento({ categoria: 'registros', parceiroId: resultado.registro.parceiro_id });
    return resultado;
  });
}

function registroOrgaoDeLinha(r: typeof schema.registroOrgaos.$inferSelect): RegistroOrgaoStatus {
  return {
    id: r.id,
    tenant_id: r.tenantId,
    registro_id: r.registroId,
    orgao: r.orgao as OrgaoBureau,
    status: r.status as RegistroOrgaoStatus['status'],
    baixado_em: r.baixadoEm,
    created_at: r.createdAt,
  };
}

function nadaConstaDeLinha(n: typeof schema.nadaConstaEmissoes.$inferSelect): NadaConstaEmissao {
  return {
    id: n.id,
    tenant_id: n.tenantId,
    registro_id: n.registroId,
    associado_id: n.associadoId,
    protocolo_consulta: n.protocoloConsulta,
    documento_base64: n.documentoBase64,
    mime_type: n.mimeType,
    emitido_em: n.emitidoEm,
  };
}

/** Status por órgão de todos os registros de um parceiro (ou de todos, se
 * chamado sem parceiroId — visão admin), usado no popup "Ver nomes". */
async function getStatusOrgaosPorParceiro(parceiroId?: string): Promise<Record<string, RegistroOrgaoStatus[]>> {
  const registrosIds = parceiroId
    ? (await db().select({ id: schema.registros.id }).from(schema.registros).where(eq(schema.registros.parceiroId, parceiroId))).map((r) => r.id)
    : null;

  const linhas = registrosIds
    ? registrosIds.length === 0
      ? []
      : await db().select().from(schema.registroOrgaos).where(inArray(schema.registroOrgaos.registroId, registrosIds))
    : await db().select().from(schema.registroOrgaos);

  const porRegistro: Record<string, RegistroOrgaoStatus[]> = {};
  for (const linha of linhas) {
    const item = registroOrgaoDeLinha(linha);
    (porRegistro[item.registro_id] ??= []).push(item);
  }
  return porRegistro;
}

/** Emissões de nada consta de todos os registros de um parceiro (ou de todos, se admin). */
async function getNadaConstaPorParceiro(parceiroId?: string): Promise<Record<string, NadaConstaEmissao>> {
  const registrosIds = parceiroId
    ? (await db().select({ id: schema.registros.id }).from(schema.registros).where(eq(schema.registros.parceiroId, parceiroId))).map((r) => r.id)
    : null;

  const linhas = registrosIds
    ? registrosIds.length === 0
      ? []
      : await db().select().from(schema.nadaConstaEmissoes).where(inArray(schema.nadaConstaEmissoes.registroId, registrosIds))
    : await db().select().from(schema.nadaConstaEmissoes);

  const porRegistro: Record<string, NadaConstaEmissao> = {};
  for (const linha of linhas) {
    const item = nadaConstaDeLinha(linha);
    porRegistro[item.registro_id] = item;
  }
  return porRegistro;
}

/** Gera e grava a certidão de nada consta (mock) pra um registro — chamado
 * automaticamente assim que o último órgão dá baixa. */
async function emitirNadaConsta(registroId: string): Promise<NadaConstaEmissao> {
  const [reg] = await db().select().from(schema.registros).where(eq(schema.registros.id, registroId));
  if (!reg) throw new Error('Registro não localizado.');

  const [existente] = await db().select().from(schema.nadaConstaEmissoes).where(eq(schema.nadaConstaEmissoes.registroId, registroId));
  if (existente) return nadaConstaDeLinha(existente);

  const resultado = await getNadaConstaProvider().emitir({
    nome: reg.nome,
    cpfCnpj: reg.cpfCnpj,
    registroId: reg.id,
  });

  const novo = {
    id: novoId('nc'),
    tenantId: reg.tenantId,
    registroId: reg.id,
    associadoId: reg.associadoId,
    protocoloConsulta: resultado.protocoloConsulta,
    documentoBase64: resultado.documentoBase64,
    mimeType: resultado.mimeType,
    emitidoEm: resultado.emitidoEm.toISOString(),
  };
  await db().insert(schema.nadaConstaEmissoes).values(novo);
  return nadaConstaDeLinha(novo as typeof schema.nadaConstaEmissoes.$inferSelect);
}

/** Admin marca um órgão como baixado pra um registro protocolado. Quando o
 * último dos 5 órgãos fica baixado, transiciona o registro inteiro pra
 * "baixado" (I2: gera ProcessEvent, transição já prevista na máquina de
 * estados) e emite o nada consta automaticamente. */
async function marcarOrgaoBaixado(
  registroId: string,
  orgao: OrgaoBureau,
  atorUserId: string,
): Promise<{ orgaos: RegistroOrgaoStatus[]; registroFoiBaixado: boolean }> {
  if (!ORGAOS_BUREAU.includes(orgao)) throw new Error(`Órgão inválido: "${orgao}".`);

  const [reg] = await db().select().from(schema.registros).where(eq(schema.registros.id, registroId));
  if (!reg) throw new Error('Registro não localizado.');
  if (reg.processStatus !== 'protocolado') {
    throw new Error('Só é possível registrar baixa de órgão em registros protocolados.');
  }

  const now = new Date().toISOString();
  await db()
    .update(schema.registroOrgaos)
    .set({ status: 'baixado', baixadoEm: now })
    .where(and(eq(schema.registroOrgaos.registroId, registroId), eq(schema.registroOrgaos.orgao, orgao)));

  const linhas = await db().select().from(schema.registroOrgaos).where(eq(schema.registroOrgaos.registroId, registroId));
  const orgaos = linhas.map(registroOrgaoDeLinha);
  const todosBaixados = orgaos.length === ORGAOS_BUREAU.length && orgaos.every((o) => o.status === 'baixado');

  if (todosBaixados) {
    await transitionStatus(registroId, 'baixado', 'Todos os órgãos deram baixa', atorUserId, 'system');
    await emitirNadaConsta(registroId);
  } else {
    // transitionStatus (acima) já avisa quando o registro inteiro vira
    // "baixado" — aqui é só a baixa parcial de um órgão, que também precisa
    // aparecer na hora no popup "Ver nomes anexados" do parceiro.
    emitirEvento({ categoria: 'registros', parceiroId: reg.parceiroId });
  }

  return { orgaos, registroFoiBaixado: todosBaixados };
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

/** Revelação do CPF/CNPJ do associado sob clique, com auditoria (I6) — usada
 * na aba Associados do admin, onde a busca é pelo associado diretamente
 * (ele existe independente de estar em algum lote/registro). */
async function revealAssociadoCpf(associadoId: string, userId: string): Promise<string> {
  const [associado] = await db().select().from(schema.associados).where(eq(schema.associados.id, associadoId));
  if (!associado) throw new Error('Associado não localizado.');

  await db().insert(schema.auditLog).values({
    id: novoId('audit'),
    tenantId: associado.tenantId,
    atorUserId: userId,
    acao: 'REVELACAO_DOCUMENTO_LGPD',
    entidadeTipo: 'associados',
    entidadeId: associado.id,
    ip: '127.0.0.1',
    userAgent: 'ABDCM-Admin-Console',
    ocorridoEm: new Date().toISOString(),
  });

  return associado.cpfCnpjRaw;
}

const ASSOCIADO_STATUS_REASON_CODES = [
  'solicitacao_associado',
  'suspeita_fraude',
  'documentacao_invalida',
  'duplicidade',
  'reativacao_apos_revisao',
  'outro',
] as const;

/** Bloqueia ou reativa o acesso de um associado (status_filiacao ativo/inativo)
 * — ação administrativa que exige reason_code de lista fechada + observação (I11). */
async function updateAssociadoStatus(
  associadoId: string,
  novoStatus: 'ativo' | 'inativo',
  reasonCode: string,
  atorUserId: string,
  observacao?: string,
): Promise<Associado> {
  if (!ASSOCIADO_STATUS_REASON_CODES.includes(reasonCode as (typeof ASSOCIADO_STATUS_REASON_CODES)[number])) {
    throw new Error('Motivo inválido.');
  }
  const [atual] = await db().select().from(schema.associados).where(eq(schema.associados.id, associadoId));
  if (!atual) throw new Error('Associado não localizado.');

  await db().update(schema.associados).set({ statusFiliacao: novoStatus }).where(eq(schema.associados.id, associadoId));

  await db().insert(schema.auditLog).values({
    id: novoId('audit'),
    tenantId: atual.tenantId,
    atorUserId,
    acao: novoStatus === 'inativo' ? 'ASSOCIADO_ACESSO_BLOQUEADO' : 'ASSOCIADO_ACESSO_REATIVADO',
    entidadeTipo: 'associados',
    entidadeId: associadoId,
    antes: { statusFiliacao: atual.statusFiliacao },
    depois: { statusFiliacao: novoStatus, reasonCode, observacao: observacao?.trim() || null },
    ip: '127.0.0.1',
    userAgent: 'ABDCM-Admin-Console',
    ocorridoEm: new Date().toISOString(),
  });

  return associadoDeLinha({ ...atual, statusFiliacao: novoStatus });
}

/** Atualiza dados de configuração do lote (ex.: prazo de encerramento) — só admin usa. */
async function updateLote(
  id: string,
  atorUserId: string,
  campos: {
    closesAt?: string;
    nome?: string;
    numeroProcesso?: string;
    varaTribunal?: string;
    juiz?: string;
    referenciaProtocolo?: string;
    dataProtocolo?: string;
    dataDistribuicao?: string;
    liminarStatus?: string;
  },
): Promise<Lote> {
  const [atual] = await db().select().from(schema.lotes).where(eq(schema.lotes.id, id));
  if (!atual) throw new Error('Lote não encontrado.');

  const patch: Partial<LoteRow> = {};
  if (campos.closesAt) patch.closesAt = campos.closesAt;
  if (campos.nome) patch.nome = campos.nome;
  if (campos.numeroProcesso !== undefined) patch.numeroProcesso = campos.numeroProcesso || null;
  if (campos.varaTribunal !== undefined) patch.varaTribunal = campos.varaTribunal || null;
  if (campos.juiz !== undefined) patch.juiz = campos.juiz || null;
  if (campos.referenciaProtocolo !== undefined) patch.referenciaProtocolo = campos.referenciaProtocolo || null;
  if (campos.dataProtocolo !== undefined) patch.dataProtocolo = campos.dataProtocolo || null;
  if (campos.dataDistribuicao !== undefined) patch.dataDistribuicao = campos.dataDistribuicao || null;
  if (campos.liminarStatus !== undefined) patch.liminarStatus = campos.liminarStatus || null;

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

  emitirEvento({ categoria: 'lotes' });
  // Número do processo chegou ou mudou — (re)abre o monitoramento
  // automático com o número certo. Sem await de propósito: não faz sentido
  // segurar a resposta da edição do lote esperando uma chamada de rede pro
  // provedor de monitoramento (mesmo raciocínio do PIX em submitBatch).
  if (patch.numeroProcesso && patch.numeroProcesso !== atual.numeroProcesso) {
    iniciarMonitoramentoProcesso(id).catch(() => {});
  }
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
    juditTrackingId: null,
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

  emitirEvento({ categoria: 'lotes' });
  if (linha.numeroProcesso) iniciarMonitoramentoProcesso(linha.id).catch(() => {});
  return loteDeLinha(linha);
}

// ---------------------------------------------------------------------
// Monitoramento processual automático (via API real — ver
// src/integrations/monitoramento). Abre um acompanhamento assim que o lote
// ganha (ou troca) numero_processo; o provedor avisa por webhook quando o
// processo se mexe, com uma reconciliação periódica de reforço (ver
// server.ts) cobrindo webhook perdido/atrasado — mesma dupla estratégia já
// usada pra PIX (webhook + reconciliarPixPendentes).
// ---------------------------------------------------------------------

/** Abre (ou reabre, se o número do processo mudou) o monitoramento
 * automático de um lote junto ao provedor configurado. Melhor-esforço: uma
 * falha aqui (provedor fora do ar, chave ausente, APP_PUBLIC_URL não
 * configurado) nunca derruba a criação/edição do lote — só fica sem
 * monitoramento até alguém corrigir e editar o numero_processo de novo,
 * o que tenta abrir de novo. */
async function iniciarMonitoramentoProcesso(loteId: string): Promise<void> {
  const [lote] = await db().select().from(schema.lotes).where(eq(schema.lotes.id, loteId));
  if (!lote || !lote.numeroProcesso) return;

  // APP_PUBLIC_URL só é exigido com o provedor real configurado — o mock
  // nem usa a callbackUrl (não fala com rede nenhuma), então precisa
  // continuar funcionando sem nenhuma variável extra (CLAUDE.md seção 8).
  const baseUrl = process.env.APP_PUBLIC_URL;
  if (monitoramentoProviderConfigurado() && !baseUrl) {
    console.warn(
      `[monitoramento-processual] APP_PUBLIC_URL não configurado — pulando abertura de monitoramento pro lote ${loteId}.`,
    );
    return;
  }

  try {
    const { trackingId } = await getMonitoramentoProvider().criarMonitoramento({
      numeroProcesso: lote.numeroProcesso,
      callbackUrl: baseUrl ? `${baseUrl.replace(/\/$/, '')}/api/webhooks/monitoramento-processo` : '',
    });
    await registrarCustoApi('monitoramento_judit', 'criar_monitoramento', loteId);
    await db().update(schema.lotes).set({ juditTrackingId: trackingId }).where(eq(schema.lotes.id, loteId));
  } catch (err) {
    console.error(`[monitoramento-processual] falha ao abrir monitoramento pro lote ${loteId}:`, err);
  }
}

/** Grava só as movimentações realmente novas (dedup por descrição+data —
 * webhook redisparado ou reconciliação encontrando o que o webhook já
 * trouxe não duplica linha). Retorna quantas entraram. */
async function registrarMovimentacoesProcesso(
  loteId: string,
  tenantId: string,
  movimentacoes: { descricao: string; ocorridoEm: Date | null; fonte?: string | null }[],
  origem: 'webhook' | 'reconciliacao',
): Promise<number> {
  if (movimentacoes.length === 0) return 0;

  const existentes = await db()
    .select({ descricao: schema.processoMovimentacoes.descricao, ocorridoEm: schema.processoMovimentacoes.ocorridoEm })
    .from(schema.processoMovimentacoes)
    .where(eq(schema.processoMovimentacoes.loteId, loteId));
  const chavesExistentes = new Set(existentes.map((e) => `${e.descricao}|${e.ocorridoEm ?? ''}`));

  const novas = movimentacoes.filter(
    (m) => !chavesExistentes.has(`${m.descricao}|${m.ocorridoEm ? m.ocorridoEm.toISOString() : ''}`),
  );
  if (novas.length === 0) return 0;

  const now = new Date().toISOString();
  await db()
    .insert(schema.processoMovimentacoes)
    .values(
      novas.map((m) => ({
        id: novoId('movproc'),
        tenantId,
        loteId,
        descricao: m.descricao,
        ocorridoEm: m.ocorridoEm ? m.ocorridoEm.toISOString() : null,
        fonte: m.fonte ?? null,
        origem,
        criadoEm: now,
      })),
    );
  return novas.length;
}

/** Recebe o webhook do provedor de monitoramento, valida e grava as
 * movimentações novas do lote correspondente (casado pelo tracking id).
 * Webhook de um tracking que não corresponde a nenhum lote conhecido (ex.:
 * monitoramento antigo, órfão) é ignorado, não é erro. */
async function processarWebhookMonitoramentoProcesso(
  payload: unknown,
  headers: Record<string, string | string[] | undefined>,
): Promise<{ loteId: string; novasMovimentacoes: number } | null> {
  const atualizacao = await getMonitoramentoProvider().validarWebhook(payload, headers);

  const [lote] = await db().select().from(schema.lotes).where(eq(schema.lotes.juditTrackingId, atualizacao.trackingId));
  if (!lote) return null;

  const novasMovimentacoes = await registrarMovimentacoesProcesso(lote.id, lote.tenantId, atualizacao.movimentacoes, 'webhook');
  if (novasMovimentacoes > 0) emitirEvento({ categoria: 'lotes' });
  return { loteId: lote.id, novasMovimentacoes };
}

export interface ResultadoReconciliacaoMonitoramento {
  verificados: number;
  novasMovimentacoes: number;
}

/** Consulta ativamente o provedor de monitoramento pra cada lote com
 * acompanhamento aberto — cobre webhook perdido/atrasado. Roda num
 * intervalo bem mais espaçado que a reconciliação de PIX (server.ts):
 * andamento processual não muda a cada segundo. */
async function reconciliarMonitoramentoPendente(): Promise<ResultadoReconciliacaoMonitoramento> {
  const lotesMonitorados = await db().select().from(schema.lotes).where(isNotNull(schema.lotes.juditTrackingId));
  const provider = getMonitoramentoProvider();
  let novasMovimentacoes = 0;

  for (const lote of lotesMonitorados) {
    try {
      const movimentacoes = await provider.consultarMovimentacoes(lote.juditTrackingId!);
      await registrarCustoApi('monitoramento_judit', 'consultar_movimentacoes', lote.id);
      novasMovimentacoes += await registrarMovimentacoesProcesso(lote.id, lote.tenantId, movimentacoes, 'reconciliacao');
    } catch (err) {
      console.error(`[reconciliarMonitoramentoPendente] falha ao consultar lote ${lote.id}:`, err);
    }
  }

  if (novasMovimentacoes > 0) emitirEvento({ categoria: 'lotes' });
  return { verificados: lotesMonitorados.length, novasMovimentacoes };
}

async function getMovimentacoesProcesso(loteId: string): Promise<MovimentacaoProcesso[]> {
  const linhas = await db()
    .select()
    .from(schema.processoMovimentacoes)
    .where(eq(schema.processoMovimentacoes.loteId, loteId))
    .orderBy(desc(schema.processoMovimentacoes.criadoEm));
  return linhas.map(movimentacaoProcessoDeLinha);
}

// ---------------------------------------------------------------------
// Consulta de baixa via Serasa (via API real — ver src/integrations/bureau).
// Read-only: pra cada registro protocolado com o órgão "serasa" ainda
// pendente, pergunta ao provedor se a restrição ainda está ativa. Quando
// não estiver mais, a baixa entra pelo MESMO caminho da baixa manual —
// marcarOrgaoBaixado() — que já gera ProcessEvent (I2) e, se for o último
// órgão pendente, transiciona o registro inteiro. Sem provedor real
// configurado, o mock sempre responde "ainda ativa" (nunca inventa baixa).
// ---------------------------------------------------------------------

export interface ResultadoReconciliacaoBureau {
  verificados: number;
  baixasDetectadas: number;
}

async function reconciliarBureauPendente(): Promise<ResultadoReconciliacaoBureau> {
  const pendentes = await db()
    .select({
      orgaoId: schema.registroOrgaos.id,
      registroId: schema.registroOrgaos.registroId,
      associadoId: schema.registros.associadoId,
      processStatus: schema.registros.processStatus,
    })
    .from(schema.registroOrgaos)
    .innerJoin(schema.registros, eq(schema.registros.id, schema.registroOrgaos.registroId))
    .where(and(eq(schema.registroOrgaos.orgao, 'serasa'), eq(schema.registroOrgaos.status, 'pendente')));

  const relevantes = pendentes.filter((p) => p.processStatus === 'protocolado');
  if (relevantes.length === 0) return { verificados: 0, baixasDetectadas: 0 };

  const provider = getBureauProvider();
  let baixasDetectadas = 0;

  for (const p of relevantes) {
    try {
      const [associado] = await db().select().from(schema.associados).where(eq(schema.associados.id, p.associadoId));
      if (!associado) continue;

      const status = await provider.consultarStatus({ cpfCnpj: associado.cpfCnpjRaw });
      await registrarCustoApi('bureau_serasa', 'consultar_status', p.registroId);

      if (!status.restricaoAtiva) {
        await marcarOrgaoBaixado(p.registroId, 'serasa', 'system');
        baixasDetectadas += 1;
      }
    } catch (err) {
      console.error(`[reconciliarBureauPendente] falha ao consultar registro ${p.registroId}:`, err);
    }
  }

  return { verificados: relevantes.length, baixasDetectadas };
}

// ---------------------------------------------------------------------
// Credenciais de integração (chave de API guardada no banco, criptografada
// — I10 revisado, ver CLAUDE.md seção 2) e custo por chamada de API paga.
// ---------------------------------------------------------------------

const CONFIGURADO_POR_PROVIDER: Record<string, () => boolean> = {
  pix_asaas: pixProviderConfigurado,
  whatsapp_zapi: whatsAppProviderConfigurado,
  storage_r2: storageProviderConfigurado,
  ocr_claude: ocrProviderConfigurado,
  monitoramento_judit: monitoramentoProviderConfigurado,
  bureau_serasa: bureauProviderConfigurado,
};

/** Carrega as credenciais salvas no banco pro cache em memória (src/server/security/credentialsCache)
 * — chamado na subida do servidor, antes de qualquer provider real poder ser instanciado. */
async function carregarCredenciaisIntegracaoCache(): Promise<void> {
  const linhas = await db().select().from(schema.credenciaisIntegracao).where(eq(schema.credenciaisIntegracao.tenantId, ABDCM_TENANT_ID));
  for (const linha of linhas) {
    try {
      definirCredencialCache(linha.provider, descriptografarValores(linha.dadosCriptografados));
    } catch (err) {
      console.error(`[credenciais-integracao] falha ao decifrar credencial do provedor "${linha.provider}":`, err);
    }
  }
}

async function listarStatusCredenciais(): Promise<CredencialIntegracaoStatus[]> {
  const linhas = await db().select().from(schema.credenciaisIntegracao).where(eq(schema.credenciaisIntegracao.tenantId, ABDCM_TENANT_ID));
  const porProvider = new Map(linhas.map((l) => [l.provider, l]));

  return CATALOGO_INTEGRACOES.map((def) => {
    const linha = porProvider.get(def.provider);
    const configurado = CONFIGURADO_POR_PROVIDER[def.provider]?.() ?? false;
    const origem: CredencialIntegracaoStatus['origem'] = linha ? 'banco' : configurado ? 'ambiente' : 'nenhum';
    return {
      provider: def.provider,
      nome: def.nome,
      categoria: def.categoria,
      campos: def.campos,
      origem,
      configurado,
      atualizadoEm: linha?.atualizadoEm ?? null,
      atualizadoPor: linha?.atualizadoPor ?? null,
      custoUnitarioCentavos: linha?.custoUnitarioCentavos ?? null,
      unidadeCusto: linha?.unidadeCusto ?? def.unidadeCustoPadrao,
    };
  });
}

/** Salva (cria ou atualiza) a credencial de um provedor — criptografada no banco, cache
 * atualizado na hora (I10 revisado). Só campos preenchidos são gravados; nenhum valor
 * real de chave aparece em log, resposta de API ou auditoria — só os nomes dos campos. */
async function salvarCredencialIntegracao(
  provider: string,
  valores: Record<string, string>,
  custoUnitarioCentavos: number | null,
  unidadeCusto: string | null,
  atorUserId: string,
): Promise<void> {
  const def = definicaoIntegracao(provider);
  if (!def) throw new Error(`Integração desconhecida: "${provider}".`);

  const faltando = def.campos.filter((c) => c.obrigatorio && !valores[c.chave]?.trim());
  if (faltando.length > 0) {
    throw new Error(`Campo obrigatório ausente: ${faltando.map((c) => c.rotulo).join(', ')}.`);
  }

  const valoresLimpos: Record<string, string> = {};
  const chavesPreenchidas: string[] = [];
  for (const campo of def.campos) {
    const v = valores[campo.chave]?.trim();
    if (v) {
      valoresLimpos[campo.chave] = v;
      chavesPreenchidas.push(campo.chave);
    }
  }
  if (chavesPreenchidas.length === 0) throw new Error('Nenhum campo preenchido.');

  const dadosCriptografados = criptografarValores(valoresLimpos);
  const now = new Date().toISOString();

  const [existente] = await db()
    .select({ id: schema.credenciaisIntegracao.id })
    .from(schema.credenciaisIntegracao)
    .where(and(eq(schema.credenciaisIntegracao.tenantId, ABDCM_TENANT_ID), eq(schema.credenciaisIntegracao.provider, provider)));

  if (existente) {
    await db()
      .update(schema.credenciaisIntegracao)
      .set({
        dadosCriptografados,
        chaves: chavesPreenchidas,
        custoUnitarioCentavos,
        unidadeCusto,
        atualizadoEm: now,
        atualizadoPor: atorUserId,
      })
      .where(eq(schema.credenciaisIntegracao.id, existente.id));
  } else {
    await db().insert(schema.credenciaisIntegracao).values({
      id: novoId('cred'),
      tenantId: ABDCM_TENANT_ID,
      provider,
      dadosCriptografados,
      chaves: chavesPreenchidas,
      custoUnitarioCentavos,
      unidadeCusto,
      atualizadoEm: now,
      atualizadoPor: atorUserId,
      criadoEm: now,
    });
  }

  definirCredencialCache(provider, valoresLimpos);

  await db().insert(schema.auditLog).values({
    id: novoId('audit'),
    tenantId: ABDCM_TENANT_ID,
    atorUserId,
    acao: 'CONFIGURACAO_CREDENCIAL_API',
    entidadeTipo: 'credenciais_integracao',
    entidadeId: provider,
    depois: { chaves: chavesPreenchidas, custoUnitarioCentavos, unidadeCusto },
    ip: '127.0.0.1',
    userAgent: 'ABDCM-Admin-Console',
    ocorridoEm: now,
  });
}

/** Revelação de credencial sob clique, com registro de auditoria obrigatório (I6, mesmo padrão de revealDocument/revealAssociadoCpf). */
async function revelarCredencialIntegracao(provider: string, atorUserId: string): Promise<Record<string, string>> {
  const [linha] = await db()
    .select()
    .from(schema.credenciaisIntegracao)
    .where(and(eq(schema.credenciaisIntegracao.tenantId, ABDCM_TENANT_ID), eq(schema.credenciaisIntegracao.provider, provider)));
  if (!linha) throw new Error('Nenhuma credencial salva no banco pra esse provedor.');

  const valores = descriptografarValores(linha.dadosCriptografados);

  await db().insert(schema.auditLog).values({
    id: novoId('audit'),
    tenantId: ABDCM_TENANT_ID,
    atorUserId,
    acao: 'REVELACAO_CREDENCIAL_API',
    entidadeTipo: 'credenciais_integracao',
    entidadeId: provider,
    ip: '127.0.0.1',
    userAgent: 'ABDCM-Admin-Console',
    ocorridoEm: new Date().toISOString(),
  });

  return valores;
}

/** Registra uma chamada paga a uma API externa, pelo custo unitário configurado (0 se
 * ainda não configurado — nunca fabricado). Melhor-esforço: uma falha aqui nunca pode
 * derrubar a chamada de API que já aconteceu de verdade (mesma postura de emitirEvento). */
async function registrarCustoApi(provider: string, operacao: string, referenciaId?: string | null): Promise<void> {
  try {
    const [cred] = await db()
      .select({ custoUnitarioCentavos: schema.credenciaisIntegracao.custoUnitarioCentavos })
      .from(schema.credenciaisIntegracao)
      .where(and(eq(schema.credenciaisIntegracao.tenantId, ABDCM_TENANT_ID), eq(schema.credenciaisIntegracao.provider, provider)));

    await db().insert(schema.apiUso).values({
      id: novoId('apiuso'),
      tenantId: ABDCM_TENANT_ID,
      provider,
      operacao,
      custoCentavos: cred?.custoUnitarioCentavos ?? 0,
      referenciaId: referenciaId ?? null,
      criadoEm: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[registrarCustoApi] falha ao registrar custo (${provider}/${operacao}):`, err);
  }
}

async function obterGastoApiPorProvider(): Promise<GastoApiPorProvider[]> {
  const [usos, credenciais] = await Promise.all([
    db().select().from(schema.apiUso).where(eq(schema.apiUso.tenantId, ABDCM_TENANT_ID)),
    db().select().from(schema.credenciaisIntegracao).where(eq(schema.credenciaisIntegracao.tenantId, ABDCM_TENANT_ID)),
  ]);
  const credPorProvider = new Map(credenciais.map((c) => [c.provider, c]));

  return CATALOGO_INTEGRACOES.map((def) => {
    const doProvider = usos.filter((u) => u.provider === def.provider);
    const cred = credPorProvider.get(def.provider);
    return {
      provider: def.provider,
      nome: def.nome,
      chamadas: doProvider.length,
      custo_total_centavos: doProvider.reduce((soma, u) => soma + u.custoCentavos, 0),
      custo_unitario_centavos: cred?.custoUnitarioCentavos ?? null,
      unidade_custo: cred?.unidadeCusto ?? def.unidadeCustoPadrao,
    };
  });
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
  emitirEvento({ categoria: 'contestacoes' });
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
  custo?: number;
  prazoDias: number;
  usaListas: boolean;
  fotoUrl?: string;
  linkRedirecionamento?: string;
}): Promise<Servico> {
  if (!data.nome?.trim()) throw new Error('Nome do serviço é obrigatório.');
  if (!Number.isInteger(data.preco) || data.preco < 0) throw new Error('Preço deve ser um valor inteiro em centavos.');
  if (data.custo !== undefined && (!Number.isInteger(data.custo) || data.custo < 0)) {
    throw new Error('Custo deve ser um valor inteiro em centavos.');
  }
  if (!Number.isInteger(data.prazoDias) || data.prazoDias < 0) throw new Error('Prazo deve ser um número inteiro de dias.');

  const novo = {
    id: novoId('serv'),
    tenantId: ABDCM_TENANT_ID,
    nome: data.nome.trim(),
    descricao: data.descricao?.trim() || null,
    preco: data.preco,
    custo: data.custo ?? 0,
    prazoDias: data.prazoDias,
    usaListas: data.usaListas,
    ativo: true,
    fotoUrl: data.fotoUrl?.trim() || null,
    linkRedirecionamento: data.linkRedirecionamento?.trim() || null,
    createdAt: new Date().toISOString(),
  };
  await db().insert(schema.servicos).values(novo);
  return servicoDeLinha(novo as ServicoRow);
}

async function updateServico(
  id: string,
  data: Partial<{
    nome: string;
    descricao: string | null;
    preco: number;
    custo: number;
    prazoDias: number;
    usaListas: boolean;
    ativo: boolean;
    fotoUrl: string | null;
    linkRedirecionamento: string | null;
  }>,
): Promise<Servico> {
  const [atual] = await db().select().from(schema.servicos).where(eq(schema.servicos.id, id));
  if (!atual) throw new Error('Serviço não encontrado.');

  const patch: Partial<ServicoRow> = {};
  if (data.nome !== undefined) patch.nome = data.nome;
  if (data.descricao !== undefined) patch.descricao = data.descricao;
  if (data.preco !== undefined) patch.preco = data.preco;
  if (data.custo !== undefined) patch.custo = data.custo;
  if (data.prazoDias !== undefined) patch.prazoDias = data.prazoDias;
  if (data.usaListas !== undefined) patch.usaListas = data.usaListas;
  if (data.ativo !== undefined) patch.ativo = data.ativo;
  if (data.fotoUrl !== undefined) patch.fotoUrl = data.fotoUrl;
  if (data.linkRedirecionamento !== undefined) patch.linkRedirecionamento = data.linkRedirecionamento;

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
// Marketing de serviços — aba Serviços > Marketing (disparo manual,
// cronograma semanal automático e o robô de grupos, este último MOCK).
// ---------------------------------------------------------------------

function associadosComWhatsapp() {
  return db()
    .select()
    .from(schema.associados)
    .where(and(eq(schema.associados.tenantId, ABDCM_TENANT_ID), eq(schema.associados.statusFiliacao, 'ativo')));
}

/** Dispara uma mensagem de marketing pro WhatsApp de todos os associados ativos. Real — via WhatsAppProvider. */
async function dispararMarketingServico(
  servicoId: string,
  mensagem: string,
  origem: 'manual' | 'automatico',
  atorUserId?: string,
): Promise<{ enviados: number; falhas: number }> {
  const [servico] = await db().select().from(schema.servicos).where(eq(schema.servicos.id, servicoId));
  if (!servico) throw new Error('Serviço não encontrado.');
  if (!mensagem?.trim()) throw new Error('Mensagem é obrigatória.');

  const associadosDb = await associadosComWhatsapp();
  let enviados = 0;
  let falhas = 0;
  for (const a of associadosDb) {
    if (!a.telefoneWhatsapp) continue;
    try {
      await getWhatsAppProvider().enviarTexto({ telefone: a.telefoneWhatsapp, texto: mensagem.trim() });
      await registrarCustoApi('whatsapp_zapi', 'enviar_texto', a.id);
      enviados += 1;
    } catch (err) {
      falhas += 1;
      console.error(`[marketing] falha ao enviar para ${a.telefoneWhatsapp}:`, err);
    }
  }

  await db().insert(schema.marketingDisparos).values({
    id: novoId('mkt'),
    tenantId: ABDCM_TENANT_ID,
    servicoId,
    origem,
    mensagem: mensagem.trim(),
    quantidadeDestinatarios: enviados,
    disparadoPorUserId: atorUserId ?? null,
    disparadoEm: new Date().toISOString(),
  });

  if (atorUserId) {
    await db().insert(schema.auditLog).values({
      id: novoId('audit'),
      tenantId: ABDCM_TENANT_ID,
      atorUserId,
      acao: 'MARKETING_DISPARO_MANUAL',
      entidadeTipo: 'servicos',
      entidadeId: servicoId,
      depois: { mensagem: mensagem.trim(), enviados, falhas },
      ip: '127.0.0.1',
      userAgent: 'ABDCM-Admin-Console',
      ocorridoEm: new Date().toISOString(),
    });
  }

  return { enviados, falhas };
}

async function getMarketingLog(): Promise<MarketingDisparo[]> {
  const linhas = await db()
    .select()
    .from(schema.marketingDisparos)
    .where(eq(schema.marketingDisparos.tenantId, ABDCM_TENANT_ID))
    .orderBy(desc(schema.marketingDisparos.disparadoEm))
    .limit(50);
  return linhas.map((d) => ({
    id: d.id,
    tenant_id: d.tenantId,
    servico_id: d.servicoId,
    origem: d.origem as 'manual' | 'automatico',
    mensagem: d.mensagem,
    quantidade_destinatarios: d.quantidadeDestinatarios,
    disparado_por_user_id: d.disparadoPorUserId,
    disparado_em: d.disparadoEm,
  }));
}

async function getMarketingCronograma(): Promise<MarketingCronogramaDia[]> {
  const linhas = await db()
    .select()
    .from(schema.marketingCronograma)
    .where(eq(schema.marketingCronograma.tenantId, ABDCM_TENANT_ID));
  return linhas
    .map((l) => ({
      id: l.id,
      tenant_id: l.tenantId,
      dia_semana: l.diaSemana,
      servico_id: l.servicoId,
      ativo: l.ativo,
      atualizado_em: l.atualizadoEm,
    }))
    .sort((a, b) => a.dia_semana - b.dia_semana);
}

/** Define o serviço em destaque de um dia da semana (0=domingo..6=sábado). Upsert manual — sem constraint nomeada no Drizzle pra usar onConflictDoUpdate aqui. */
async function setMarketingCronogramaDia(
  diaSemana: number,
  servicoId: string | null,
  ativo: boolean,
): Promise<MarketingCronogramaDia> {
  if (!Number.isInteger(diaSemana) || diaSemana < 0 || diaSemana > 6) {
    throw new Error('Dia da semana inválido (use 0 a 6).');
  }
  const [existente] = await db()
    .select()
    .from(schema.marketingCronograma)
    .where(and(eq(schema.marketingCronograma.tenantId, ABDCM_TENANT_ID), eq(schema.marketingCronograma.diaSemana, diaSemana)));

  const agora = new Date().toISOString();
  if (existente) {
    await db()
      .update(schema.marketingCronograma)
      .set({ servicoId, ativo, atualizadoEm: agora })
      .where(eq(schema.marketingCronograma.id, existente.id));
    return { id: existente.id, tenant_id: ABDCM_TENANT_ID, dia_semana: diaSemana, servico_id: servicoId, ativo, atualizado_em: agora };
  }
  const id = novoId('mktcron');
  await db().insert(schema.marketingCronograma).values({
    id,
    tenantId: ABDCM_TENANT_ID,
    diaSemana,
    servicoId,
    ativo,
    atualizadoEm: agora,
  });
  return { id, tenant_id: ABDCM_TENANT_ID, dia_semana: diaSemana, servico_id: servicoId, ativo, atualizado_em: agora };
}

/**
 * Roda pelo agendador já existente (rodarAutomacoes, a cada 15min). Dispara
 * o serviço em destaque do dia da semana atual — no máximo uma vez por dia
 * por serviço (checa marketing_disparos de hoje antes de mandar de novo).
 */
async function rodarMarketingCronogramaDoDia(): Promise<{ disparado: boolean; servicoNome?: string; enviados?: number }> {
  const diaSemana = new Date().getDay();
  const [linha] = await db()
    .select()
    .from(schema.marketingCronograma)
    .where(and(eq(schema.marketingCronograma.tenantId, ABDCM_TENANT_ID), eq(schema.marketingCronograma.diaSemana, diaSemana)));
  if (!linha?.ativo || !linha.servicoId) return { disparado: false };

  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const disparosDoServico = await db()
    .select({ origem: schema.marketingDisparos.origem, disparadoEm: schema.marketingDisparos.disparadoEm })
    .from(schema.marketingDisparos)
    .where(eq(schema.marketingDisparos.servicoId, linha.servicoId));
  const jaDisparouHoje = disparosDoServico.some((d) => d.origem === 'automatico' && new Date(d.disparadoEm) >= inicioHoje);
  if (jaDisparouHoje) return { disparado: false };

  const [servico] = await db().select().from(schema.servicos).where(eq(schema.servicos.id, linha.servicoId));
  if (!servico || !servico.ativo) return { disparado: false };

  const mensagem =
    `${servico.nome} — Aqui é da ABDCM! Hoje é dia de dar aquele empurrão: ${servico.descricao || 'confira as condições especiais deste serviço'}. ` +
    `Quer saber mais? Fale com o parceiro que cuidou da sua filiação.`;
  const { enviados } = await dispararMarketingServico(linha.servicoId, mensagem, 'automatico');
  return { disparado: true, servicoNome: servico.nome, enviados };
}

// MOCK — nenhum provedor de grupo/enquete de WhatsApp está contratado
// (CLAUDE.md seção 8: mock primeiro, provider real só quando contratado).
async function getMarketingGrupoConfig(): Promise<MarketingGrupoConfig> {
  const [linha] = await db().select().from(schema.marketingGrupoConfig).where(eq(schema.marketingGrupoConfig.tenantId, ABDCM_TENANT_ID));
  if (linha) {
    return {
      tenant_id: linha.tenantId,
      nome_grupo: linha.nomeGrupo,
      aviso_lista_ativo: linha.avisoListaAtivo,
      marketing_ativo: linha.marketingAtivo,
      enquetes_ativo: linha.enquetesAtivo,
      atualizado_em: linha.atualizadoEm,
    };
  }
  return {
    tenant_id: ABDCM_TENANT_ID,
    nome_grupo: '',
    aviso_lista_ativo: false,
    marketing_ativo: false,
    enquetes_ativo: false,
    atualizado_em: new Date().toISOString(),
  };
}

async function setMarketingGrupoConfig(data: Partial<{
  nomeGrupo: string;
  avisoListaAtivo: boolean;
  marketingAtivo: boolean;
  enquetesAtivo: boolean;
}>): Promise<MarketingGrupoConfig> {
  const atual = await getMarketingGrupoConfig();
  const agora = new Date().toISOString();
  const novo = {
    tenantId: ABDCM_TENANT_ID,
    nomeGrupo: data.nomeGrupo ?? atual.nome_grupo,
    avisoListaAtivo: data.avisoListaAtivo ?? atual.aviso_lista_ativo,
    marketingAtivo: data.marketingAtivo ?? atual.marketing_ativo,
    enquetesAtivo: data.enquetesAtivo ?? atual.enquetes_ativo,
    atualizadoEm: agora,
  };
  await db()
    .insert(schema.marketingGrupoConfig)
    .values(novo)
    .onConflictDoUpdate({ target: schema.marketingGrupoConfig.tenantId, set: novo });
  return {
    tenant_id: novo.tenantId,
    nome_grupo: novo.nomeGrupo,
    aviso_lista_ativo: novo.avisoListaAtivo,
    marketing_ativo: novo.marketingAtivo,
    enquetes_ativo: novo.enquetesAtivo,
    atualizado_em: novo.atualizadoEm,
  };
}

// ---------------------------------------------------------------------
// Eventos e Notícias — CMS simples controlado pelo admin
// ---------------------------------------------------------------------

async function getEventosNoticias(): Promise<EventoNoticia[]> {
  const linhas = await db()
    .select()
    .from(schema.eventosNoticias)
    .where(eq(schema.eventosNoticias.tenantId, ABDCM_TENANT_ID))
    .orderBy(desc(schema.eventosNoticias.createdAt));
  return linhas.map(eventoNoticiaDeLinha);
}

async function createEventoNoticia(data: {
  tipo: string;
  titulo: string;
  descricao: string;
  categoria: string;
  imagemUrl?: string;
  linkExterno?: string;
  dataEvento?: string;
  atorUserId: string;
}): Promise<EventoNoticia> {
  if (data.tipo !== 'evento' && data.tipo !== 'noticia' && data.tipo !== 'anuncio') {
    throw new Error('Tipo inválido (use "evento", "noticia" ou "anuncio").');
  }
  if (!data.titulo?.trim()) throw new Error('Título é obrigatório.');
  if (!data.descricao?.trim()) throw new Error('Descrição é obrigatória.');
  if (!data.categoria?.trim()) throw new Error('Categoria é obrigatória.');

  const novo = {
    id: novoId('evt'),
    tenantId: ABDCM_TENANT_ID,
    tipo: data.tipo,
    titulo: data.titulo.trim(),
    descricao: data.descricao.trim(),
    categoria: data.categoria.trim(),
    imagemUrl: data.imagemUrl?.trim() || null,
    linkExterno: data.linkExterno?.trim() || null,
    dataEvento: data.dataEvento || null,
    ativo: true,
    criadoPorUserId: data.atorUserId,
    createdAt: new Date().toISOString(),
  };
  await db().insert(schema.eventosNoticias).values(novo);
  return eventoNoticiaDeLinha(novo as EventoNoticiaRow);
}

async function updateEventoNoticia(id: string, data: Partial<{ ativo: boolean }>): Promise<EventoNoticia> {
  const [atual] = await db()
    .select()
    .from(schema.eventosNoticias)
    .where(and(eq(schema.eventosNoticias.id, id), eq(schema.eventosNoticias.tenantId, ABDCM_TENANT_ID)));
  if (!atual) throw new Error('Registro não encontrado.');

  const patch: Partial<EventoNoticiaRow> = {};
  if (data.ativo !== undefined) patch.ativo = data.ativo;

  await db().update(schema.eventosNoticias).set(patch).where(eq(schema.eventosNoticias.id, id));
  return eventoNoticiaDeLinha({ ...atual, ...patch });
}

async function deleteEventoNoticia(id: string): Promise<void> {
  await db()
    .delete(schema.eventosNoticias)
    .where(and(eq(schema.eventosNoticias.id, id), eq(schema.eventosNoticias.tenantId, ABDCM_TENANT_ID)));
}

// ---------------------------------------------------------------------
// Dados cadastrais da empresa (empresa, banco, OAB) — uma linha por tenant
// ---------------------------------------------------------------------

async function getConfiguracaoEmpresa(): Promise<ConfiguracaoEmpresa> {
  const [linha] = await db().select().from(schema.configuracaoEmpresa).where(eq(schema.configuracaoEmpresa.tenantId, ABDCM_TENANT_ID));
  if (linha) {
    return {
      tenant_id: linha.tenantId,
      razao_social: linha.razaoSocial,
      cnpj: linha.cnpj,
      endereco: linha.endereco,
      telefone: linha.telefone,
      email: linha.email,
      banco_nome: linha.bancoNome,
      banco_agencia: linha.bancoAgencia,
      banco_conta: linha.bancoConta,
      banco_pix_chave: linha.bancoPixChave,
      oab_numero: linha.oabNumero,
      oab_uf: linha.oabUf,
      atualizado_em: linha.atualizadoEm,
    };
  }
  const now = new Date().toISOString();
  return {
    tenant_id: ABDCM_TENANT_ID,
    razao_social: '',
    cnpj: '',
    endereco: '',
    telefone: '',
    email: '',
    banco_nome: '',
    banco_agencia: '',
    banco_conta: '',
    banco_pix_chave: '',
    oab_numero: '',
    oab_uf: '',
    atualizado_em: now,
  };
}

async function setConfiguracaoEmpresa(data: Omit<ConfiguracaoEmpresa, 'tenant_id' | 'atualizado_em'>): Promise<ConfiguracaoEmpresa> {
  const now = new Date().toISOString();
  const linha = {
    tenantId: ABDCM_TENANT_ID,
    razaoSocial: data.razao_social,
    cnpj: data.cnpj,
    endereco: data.endereco,
    telefone: data.telefone,
    email: data.email,
    bancoNome: data.banco_nome,
    bancoAgencia: data.banco_agencia,
    bancoConta: data.banco_conta,
    bancoPixChave: data.banco_pix_chave,
    oabNumero: data.oab_numero,
    oabUf: data.oab_uf,
    atualizadoEm: now,
  };
  await db()
    .insert(schema.configuracaoEmpresa)
    .values(linha)
    .onConflictDoUpdate({ target: schema.configuracaoEmpresa.tenantId, set: linha });
  return { ...data, tenant_id: ABDCM_TENANT_ID, atualizado_em: now };
}

// ---------------------------------------------------------------------
// Contratos e Documentos Complementares (o admin anexa quantos quiser —
// ficha associativa modelo, contrato de intermediação etc; associados e
// parceiros só leem/baixam).
// ---------------------------------------------------------------------

async function getContratos(): Promise<Contrato[]> {
  const linhas = await db()
    .select()
    .from(schema.contratos)
    .where(eq(schema.contratos.tenantId, ABDCM_TENANT_ID))
    .orderBy(desc(schema.contratos.atualizadoEm));
  return linhas.map(contratoDeLinha);
}

async function addContrato(data: {
  titulo: string;
  nomeArquivo: string;
  mimeType: string;
  conteudoBase64: string;
}): Promise<Contrato> {
  if (!data.titulo.trim()) throw new Error('Título do documento é obrigatório.');
  if (!data.nomeArquivo || !data.conteudoBase64) {
    throw new Error('Arquivo do documento é obrigatório.');
  }
  const novo = {
    id: novoId('contrato'),
    tenantId: ABDCM_TENANT_ID,
    titulo: data.titulo.trim(),
    nomeArquivo: data.nomeArquivo,
    mimeType: data.mimeType,
    conteudoBase64: data.conteudoBase64,
    atualizadoEm: new Date().toISOString(),
  };
  await db().insert(schema.contratos).values(novo);
  return contratoDeLinha(novo as ContratoRow);
}

async function deleteContrato(id: string): Promise<void> {
  await db().delete(schema.contratos).where(and(eq(schema.contratos.id, id), eq(schema.contratos.tenantId, ABDCM_TENANT_ID)));
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
  cadastro_associado: {
    nome: 'Boas-vindas ao se cadastrar',
    descricao:
      'Manda uma mensagem de boas-vindas assim que um associado com WhatsApp cadastrado entra no sistema (cadastro individual ou por planilha).',
    exemplo:
      'Boa tarde João! Aqui é da ABDCM 👋 Seja muito bem-vindo(a) ao sistema ABDCM! Você agora faz parte da nossa Ação Coletiva Limpa Nome — fica de olho por aqui que a gente avisa assim que a próxima lista abrir pra você anexar seus nomes.',
    configPadrao: {},
  },
};

/** Substitui tokens {saudacao}, {nome} etc. em templates editáveis pelo admin. */
export function aplicarTemplateMensagem(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, chave) => tokens[chave] ?? match);
}

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
// Mensagens extras por gatilho — aba Automações > "Criar Nova Mensagem"
// ---------------------------------------------------------------------

function mensagemExtraDeLinha(m: typeof schema.mensagensExtra.$inferSelect): MensagemExtra {
  return {
    id: m.id,
    tenant_id: m.tenantId,
    gatilho: m.gatilho as TipoNotificacao,
    nome: m.nome,
    mensagem: m.mensagem,
    ativo: m.ativo,
    created_at: m.createdAt,
  };
}

export async function getMensagensExtra(): Promise<MensagemExtra[]> {
  const linhas = await db().select().from(schema.mensagensExtra).where(eq(schema.mensagensExtra.tenantId, ABDCM_TENANT_ID));
  return linhas.map(mensagemExtraDeLinha);
}

async function createMensagemExtra(data: { gatilho: TipoNotificacao; nome: string; mensagem: string }): Promise<MensagemExtra> {
  if (!(data.gatilho in AUTOMACOES_DISPONIVEIS)) throw new Error('Gatilho inválido.');
  if (!data.nome?.trim()) throw new Error('Nome é obrigatório.');
  if (!data.mensagem?.trim()) throw new Error('Mensagem é obrigatória.');

  const novo = {
    id: novoId('msgx'),
    tenantId: ABDCM_TENANT_ID,
    gatilho: data.gatilho,
    nome: data.nome.trim(),
    mensagem: data.mensagem.trim(),
    ativo: true,
    createdAt: new Date().toISOString(),
  };
  await db().insert(schema.mensagensExtra).values(novo);
  return mensagemExtraDeLinha(novo as typeof schema.mensagensExtra.$inferSelect);
}

async function updateMensagemExtra(id: string, data: Partial<{ nome: string; mensagem: string; ativo: boolean }>): Promise<MensagemExtra> {
  const [atual] = await db().select().from(schema.mensagensExtra).where(eq(schema.mensagensExtra.id, id));
  if (!atual) throw new Error('Mensagem não encontrada.');
  const patch: Partial<typeof schema.mensagensExtra.$inferSelect> = {};
  if (data.nome !== undefined) patch.nome = data.nome;
  if (data.mensagem !== undefined) patch.mensagem = data.mensagem;
  if (data.ativo !== undefined) patch.ativo = data.ativo;
  await db().update(schema.mensagensExtra).set(patch).where(eq(schema.mensagensExtra.id, id));
  return mensagemExtraDeLinha({ ...atual, ...patch });
}

async function deleteMensagemExtra(id: string): Promise<void> {
  await db().delete(schema.mensagensExtra).where(eq(schema.mensagensExtra.id, id));
}

// ---------------------------------------------------------------------
// Automação de ligação — MOCK (ver migration 0013 / CLAUDE.md seção 8)
// ---------------------------------------------------------------------

function chamadaConfigDeLinha(c: typeof schema.chamadasConfig.$inferSelect): ChamadaConfig {
  return {
    id: c.id,
    tenant_id: c.tenantId,
    servico_id: c.servicoId,
    nome: c.nome,
    roteiro_abertura: c.roteiroAbertura,
    roteiro_resposta_sim: c.roteiroRespostaSim,
    roteiro_resposta_nao: c.roteiroRespostaNao,
    dias_antes_prazo: c.diasAntesPrazo,
    ativo: c.ativo,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

function chamadaLogDeLinha(l: typeof schema.chamadasLog.$inferSelect): ChamadaLog {
  return {
    id: l.id,
    tenant_id: l.tenantId,
    config_id: l.configId,
    servico_id: l.servicoId,
    associado_id: l.associadoId,
    telefone: l.telefone,
    resultado: l.resultado as ChamadaLog['resultado'],
    transcricao: l.transcricao,
    origem: l.origem as ChamadaLog['origem'],
    criado_em: l.criadoEm,
  };
}

async function getChamadasConfig(): Promise<ChamadaConfig[]> {
  const linhas = await db().select().from(schema.chamadasConfig).where(eq(schema.chamadasConfig.tenantId, ABDCM_TENANT_ID));
  return linhas.map(chamadaConfigDeLinha);
}

async function createChamadaConfig(data: {
  servicoId?: string | null;
  nome: string;
  roteiroAbertura: string;
  roteiroRespostaSim: string;
  roteiroRespostaNao: string;
  diasAntesPrazo?: number | null;
}): Promise<ChamadaConfig> {
  if (!data.nome?.trim()) throw new Error('Nome é obrigatório.');
  if (!data.roteiroAbertura?.trim() || !data.roteiroRespostaSim?.trim() || !data.roteiroRespostaNao?.trim()) {
    throw new Error('Preencha o roteiro de abertura e as duas respostas (sim/não).');
  }
  const agora = new Date().toISOString();
  const novo = {
    id: novoId('call-cfg'),
    tenantId: ABDCM_TENANT_ID,
    servicoId: data.servicoId || null,
    nome: data.nome.trim(),
    roteiroAbertura: data.roteiroAbertura.trim(),
    roteiroRespostaSim: data.roteiroRespostaSim.trim(),
    roteiroRespostaNao: data.roteiroRespostaNao.trim(),
    diasAntesPrazo: data.diasAntesPrazo ?? null,
    ativo: true,
    createdAt: agora,
    updatedAt: agora,
  };
  await db().insert(schema.chamadasConfig).values(novo);
  return chamadaConfigDeLinha(novo as typeof schema.chamadasConfig.$inferSelect);
}

async function updateChamadaConfig(
  id: string,
  data: Partial<{
    nome: string;
    roteiroAbertura: string;
    roteiroRespostaSim: string;
    roteiroRespostaNao: string;
    diasAntesPrazo: number | null;
    ativo: boolean;
  }>,
): Promise<ChamadaConfig> {
  const [atual] = await db().select().from(schema.chamadasConfig).where(eq(schema.chamadasConfig.id, id));
  if (!atual) throw new Error('Configuração de ligação não encontrada.');
  const patch: Partial<typeof schema.chamadasConfig.$inferSelect> = { updatedAt: new Date().toISOString() };
  if (data.nome !== undefined) patch.nome = data.nome;
  if (data.roteiroAbertura !== undefined) patch.roteiroAbertura = data.roteiroAbertura;
  if (data.roteiroRespostaSim !== undefined) patch.roteiroRespostaSim = data.roteiroRespostaSim;
  if (data.roteiroRespostaNao !== undefined) patch.roteiroRespostaNao = data.roteiroRespostaNao;
  if (data.diasAntesPrazo !== undefined) patch.diasAntesPrazo = data.diasAntesPrazo;
  if (data.ativo !== undefined) patch.ativo = data.ativo;
  await db().update(schema.chamadasConfig).set(patch).where(eq(schema.chamadasConfig.id, id));
  return chamadaConfigDeLinha({ ...atual, ...patch });
}

async function deleteChamadaConfig(id: string): Promise<void> {
  await db().delete(schema.chamadasConfig).where(eq(schema.chamadasConfig.id, id));
}

async function getChamadasLog(limite = 50): Promise<ChamadaLog[]> {
  const linhas = await db()
    .select()
    .from(schema.chamadasLog)
    .where(eq(schema.chamadasLog.tenantId, ABDCM_TENANT_ID))
    .orderBy(desc(schema.chamadasLog.criadoEm))
    .limit(limite);
  return linhas.map(chamadaLogDeLinha);
}

/** Testa uma configuração de ligação num telefone qualquer — sempre MOCK, nunca liga de verdade. */
async function testarChamada(configId: string, telefone: string): Promise<ChamadaLog> {
  const [config] = await db().select().from(schema.chamadasConfig).where(eq(schema.chamadasConfig.id, configId));
  if (!config) throw new Error('Configuração de ligação não encontrada.');
  if (!telefone?.trim()) throw new Error('Telefone é obrigatório.');

  const hora = new Date().getHours();
  const tokensTeste = {
    saudacao: hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite',
    nome: 'Associado Teste',
    lote: 'Ação Coletiva',
  };
  const resultado = await getLigacaoProvider().ligar({
    telefone: telefone.trim(),
    roteiro: {
      abertura: aplicarTemplateMensagem(config.roteiroAbertura, tokensTeste),
      respostaSim: aplicarTemplateMensagem(config.roteiroRespostaSim, tokensTeste),
      respostaNao: aplicarTemplateMensagem(config.roteiroRespostaNao, tokensTeste),
    },
  });

  const novo = {
    id: novoId('call-log'),
    tenantId: ABDCM_TENANT_ID,
    configId,
    servicoId: config.servicoId,
    associadoId: null,
    telefone: telefone.trim(),
    resultado: resultado.resultado,
    transcricao: resultado.transcricao,
    origem: 'manual' as const,
    criadoEm: new Date().toISOString(),
  };
  await db().insert(schema.chamadasLog).values(novo);
  return chamadaLogDeLinha(novo as typeof schema.chamadasLog.$inferSelect);
}

/**
 * Roda pelo agendador já existente (a cada 15min). Pra cada configuração de
 * ligação com follow-up configurado (dias_antes_prazo), liga (mock) pra
 * associados elegíveis do lote vigente quando faltar exatamente esse tanto
 * de dias pro encerramento — no máximo uma vez por associado por config
 * (dedup por chamadas_log já registrado pra esse config+telefone).
 */
async function rodarFollowUpLigacoes(): Promise<number> {
  const configs = await db().select().from(schema.chamadasConfig).where(and(eq(schema.chamadasConfig.tenantId, ABDCM_TENANT_ID), eq(schema.chamadasConfig.ativo, true)));
  let totalLigacoes = 0;

  for (const config of configs) {
    if (!config.diasAntesPrazo) continue;
    const lotesAbertos = await db().select().from(schema.lotes).where(eq(schema.lotes.status, 'aberto'));

    for (const lote of lotesAbertos) {
      const diasParaFechar = Math.ceil((new Date(lote.closesAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (diasParaFechar !== config.diasAntesPrazo) continue;

      const associadosDb = await associadosComWhatsapp();
      for (const associado of associadosDb) {
        if (!associado.telefoneWhatsapp) continue;
        const jaLigou = await db()
          .select({ id: schema.chamadasLog.id })
          .from(schema.chamadasLog)
          .where(and(eq(schema.chamadasLog.configId, config.id), eq(schema.chamadasLog.telefone, associado.telefoneWhatsapp)));
        if (jaLigou.length > 0) continue;

        const resultado = await getLigacaoProvider().ligar({
          telefone: associado.telefoneWhatsapp,
          roteiro: {
            abertura: aplicarTemplateMensagem(config.roteiroAbertura, { nome: associado.nome.split(' ')[0], lote: lote.nome }),
            respostaSim: aplicarTemplateMensagem(config.roteiroRespostaSim, { nome: associado.nome.split(' ')[0], lote: lote.nome }),
            respostaNao: aplicarTemplateMensagem(config.roteiroRespostaNao, { nome: associado.nome.split(' ')[0], lote: lote.nome }),
          },
        });
        await db().insert(schema.chamadasLog).values({
          id: novoId('call-log'),
          tenantId: ABDCM_TENANT_ID,
          configId: config.id,
          servicoId: config.servicoId,
          associadoId: associado.id,
          telefone: associado.telefoneWhatsapp,
          resultado: resultado.resultado,
          transcricao: resultado.transcricao,
          origem: 'automatico',
          criadoEm: new Date().toISOString(),
        });
        totalLigacoes++;
      }
    }
  }
  return totalLigacoes;
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

/** Igual a presignDocumentoUpload, mas sem associado nem tipo ainda —
 * usado no anexo com leitura automática (OCR), onde o parceiro solta os
 * arquivos de uma vez (sem separar CNH de RG em seleções diferentes) e o
 * sistema descobre associado e tipo depois de ler a imagem. A key vira
 * permanente se o documento for confirmado depois (confirmarDocumentoUpload
 * aceita qualquer key, não só a convenção documentos/{tenant}/{associadoId}/{tipo})
 * — não precisa mover o arquivo. */
async function presignStagingUpload(
  mimeType: string,
): Promise<{ uploadUrl: string; key: string; headers?: Record<string, string> }> {
  const key = `documentos/staging/${ABDCM_TENANT_ID}/${novoId('stg')}.${extensaoPorMime(mimeType)}`;
  const { uploadUrl, headers } = await getStorageProvider().criarUrlUpload({
    key,
    contentType: mimeType,
    expiraEmSegundos: URL_STORAGE_EXPIRA_SEGUNDOS,
  });
  return { uploadUrl, key, headers };
}

export interface OcrPreviewItem {
  key: string;
  nomeArquivo: string;
  /** Tipo identificado na própria imagem — null quando a IA não conseguiu
   * classificar com clareza, e aí a escolha fica manual na conferência. */
  tipoDetectado: 'cnh' | 'rg' | 'ficha_associativa' | null;
  ocrNome: string | null;
  ocrCpf: string | null;
  confianca: 'alta' | 'baixa';
  /** Associado encontrado pelo CPF lido — mostrado como sugestão mesmo com
   * confiança baixa, pra conferência ficar rápida, mas só é usado direto
   * (sem toque humano) quando autoConfirmavel também for true. */
  associadoIdSugerido: string | null;
  associadoNomeSugerido: string | null;
  autoConfirmavel: boolean;
  associadoJaTemCnh: boolean;
  associadoJaTemRg: boolean;
  associadoJaTemFicha: boolean;
}

/** Lê cada arquivo já enviado pra um key de staging (presignStagingUpload),
 * identifica o tipo (CNH/RG) e tenta casar com um associado existente pelo
 * CPF lido, devolvendo tudo pra conferência humana (I3) — nada é gravado em
 * documentos_associado aqui. Confiança baixa, tipo não identificado ou CPF
 * não encontrado na base voltam pra fila de conferência manual (nunca
 * descarta silenciosamente). */
async function lerDocumentosOcr(
  itens: { key: string; mimeType: string; nomeArquivo: string }[],
  parceiroId?: string,
): Promise<OcrPreviewItem[]> {
  const todosAssociados = await db().select().from(schema.associados).where(eq(schema.associados.tenantId, ABDCM_TENANT_ID));
  const porCpf = new Map(todosAssociados.map((a) => [a.cpfCnpjRaw, a]));

  const todosDocs = await db().select().from(schema.documentosAssociado).where(eq(schema.documentosAssociado.tenantId, ABDCM_TENANT_ID));
  const docsPorAssociado = new Map<string, Set<string>>();
  for (const d of todosDocs) {
    if (!docsPorAssociado.has(d.associadoId)) docsPorAssociado.set(d.associadoId, new Set());
    docsPorAssociado.get(d.associadoId)!.add(d.tipo);
  }

  const ocr = getOcrProvider();

  return Promise.all(
    itens.map(async (item) => {
      const documentoUrl = resolverUrlAbsoluta(await getStorageProvider().criarUrlDownload(item.key, URL_STORAGE_EXPIRA_SEGUNDOS));
      const lido = await ocr.lerDocumento({ documentoUrl, mimeType: item.mimeType });

      const associado = lido.cpf ? porCpf.get(lido.cpf) : undefined;
      const associadoValido = associado && (!parceiroId || associado.parceiroId === parceiroId) ? associado : null;
      const docs = associadoValido ? docsPorAssociado.get(associadoValido.id) ?? new Set<string>() : new Set<string>();

      return {
        key: item.key,
        nomeArquivo: item.nomeArquivo,
        tipoDetectado: lido.tipoDocumento,
        ocrNome: lido.nome,
        ocrCpf: lido.cpf,
        confianca: lido.confianca,
        associadoIdSugerido: associadoValido?.id ?? null,
        associadoNomeSugerido: associadoValido?.nome ?? null,
        autoConfirmavel: lido.confianca === 'alta' && Boolean(associadoValido) && lido.tipoDocumento !== null,
        associadoJaTemCnh: docs.has('cnh'),
        associadoJaTemRg: docs.has('rg'),
        associadoJaTemFicha: docs.has('ficha_associativa'),
      };
    }),
  );
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

export interface FichaAssociativaGerada {
  associadoId: string;
  fichaKey: string;
  nome: string;
  cpf: string;
}

/** Gera automaticamente a ficha associativa (Termo de Autorização e
 * Representação) de um associado a partir de um documento de identidade
 * (RG/CNH) já enviado pro storage (mesmo key de presignStagingUpload) — o
 * fluxo "o parceiro só envia o documento" (upload → OCR → PDF pronto).
 *
 * Nome e CPF impressos na ficha vêm SEMPRE do registro já cadastrado do
 * associado (confirmado por humano na tela de cadastro), nunca de uma nova
 * leitura de OCR aqui — evita que um erro de leitura vá parar impresso num
 * documento com peso jurídico. O OCR roda de novo só pra achar onde está a
 * assinatura na foto (assinaturaCoords), que é puramente visual.
 *
 * A cópia da assinatura colada no PDF NUNCA é o que vale como consentimento
 * (I5/I8) — quem grava consentimento_em/ip/hash de verdade é
 * marcarFichaAssinadaPorImportacao, reaproveitada aqui como no fluxo de
 * importação por planilha. */
async function gerarFichaAssociativaAutomatica(
  associadoId: string,
  key: string,
  mimeType: string,
  atorUserId: string,
  ip: string,
  parceiroId?: string,
): Promise<FichaAssociativaGerada> {
  const [associado] = await db().select().from(schema.associados).where(eq(schema.associados.id, associadoId));
  if (!associado) throw new Error('Associado não encontrado.');
  if (parceiroId && associado.parceiroId !== parceiroId) {
    throw new Error('Este associado não pertence ao seu cadastro.');
  }

  const documentoUrl = resolverUrlAbsoluta(await getStorageProvider().criarUrlDownload(key, URL_STORAGE_EXPIRA_SEGUNDOS));
  const respostaDocumento = await fetch(documentoUrl);
  if (!respostaDocumento.ok) throw new Error('Não foi possível ler o documento enviado.');
  const documentoBytes = await respostaDocumento.arrayBuffer();

  const lido = await getOcrProvider().lerDocumento({ documentoUrl, mimeType });
  await registrarCustoApi('ocr_claude', 'ler_documento', associadoId);

  const pdfBytes = await gerarFichaAssociativaPdf({
    nome: associado.nome,
    // O CPF/CNPJ impresso na ficha precisa vir por extenso — é documento
    // jurídico usado pra protocolo junto aos birôs, não tela administrativa
    // (o mascaramento do I6 é só pra exibição em tela, nunca pro documento
    // que efetivamente prova a filiação e o consentimento do associado).
    cpf: formatDocumentFull(associado.cpfCnpjRaw),
    documentoBytes,
    documentoMimeType: mimeType,
    assinaturaCoords: lido.assinaturaCoords,
  });

  const fichaKey = `documentos/${associado.tenantId}/${associadoId}/ficha_associativa.pdf`;
  const { uploadUrl, headers } = await getStorageProvider().criarUrlUpload({
    key: fichaKey,
    contentType: 'application/pdf',
    expiraEmSegundos: URL_STORAGE_EXPIRA_SEGUNDOS,
  });
  const respostaUpload = await fetch(resolverUrlAbsoluta(uploadUrl), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf', ...(headers ?? {}) },
    body: pdfBytes,
  });
  if (!respostaUpload.ok) throw new Error('Falha ao salvar a ficha gerada.');

  await confirmarDocumentoUpload({
    associadoId,
    tipo: 'ficha_associativa',
    key: fichaKey,
    mimeType: 'application/pdf',
    nomeArquivo: `ficha_associativa_${nomeArquivoSeguro(associado.nome)}.pdf`,
    tamanhoBytes: pdfBytes.byteLength,
    atorUserId,
  });

  await marcarFichaAssinadaPorImportacao(associadoId, fichaKey, atorUserId, {
    ip,
    acao: 'GERAR_FICHA_ASSOCIATIVA_AUTOMATICA',
    userAgent: 'ABDCM-Portal',
  });

  return { associadoId, fichaKey, nome: associado.nome, cpf: associado.cpfCnpj };
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

function nomeArquivoSeguro(nome: string): string {
  return nome.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'acao_coletiva';
}

/** Planilha (xlsx) sob demanda de um lote — não muda status nem gera
 * pacote, é só o download avulso que o admin pode pedir a qualquer
 * momento (diferente de encerrarLote, que é uma ação única e destrutiva). */
async function gerarPlanilhaLoteBuffer(loteId: string): Promise<{ buffer: ExcelJS.Buffer; nomeArquivo: string }> {
  const [loteRow] = await db().select().from(schema.lotes).where(eq(schema.lotes.id, loteId));
  if (!loteRow) throw new Error('Ação Coletiva não encontrada.');

  const registrosDoLote = await db().select().from(schema.registros).where(eq(schema.registros.loteId, loteId));
  const associadoIds = [...new Set(registrosDoLote.map((r) => r.associadoId))];
  const associadosDoLote =
    associadoIds.length > 0 ? await db().select().from(schema.associados).where(inArray(schema.associados.id, associadoIds)) : [];
  const associadosPorId = new Map(associadosDoLote.map((a) => [a.id, a]));

  const buffer = await montarPlanilhaLote(registrosDoLote, associadosPorId);
  return { buffer, nomeArquivo: `lista_${nomeArquivoSeguro(loteRow.nome)}.xlsx` };
}

/** ZIP de documentos de um lote, sob demanda — `apenasTipo` filtra só um
 * tipo (ex.: só ficha_associativa). Mesma lógica de montagem de
 * encerrarLote, mas sem nenhum efeito colateral (não fecha o lote). */
async function gerarZipDocumentosLote(
  loteId: string,
  apenasTipo?: TipoDocumento,
): Promise<{ buffer: Buffer; nomeArquivo: string }> {
  const [loteRow] = await db().select().from(schema.lotes).where(eq(schema.lotes.id, loteId));
  if (!loteRow) throw new Error('Ação Coletiva não encontrada.');

  const registrosDoLote = await db().select().from(schema.registros).where(eq(schema.registros.loteId, loteId));
  const associadoIds = [...new Set(registrosDoLote.map((r) => r.associadoId))];
  const associadosDoLote =
    associadoIds.length > 0 ? await db().select().from(schema.associados).where(inArray(schema.associados.id, associadoIds)) : [];
  const associadosPorId = new Map(associadosDoLote.map((a) => [a.id, a]));

  let documentosDoLote =
    associadoIds.length > 0
      ? await db().select().from(schema.documentosAssociado).where(inArray(schema.documentosAssociado.associadoId, associadoIds))
      : [];
  if (apenasTipo) documentosDoLote = documentosDoLote.filter((d) => d.tipo === apenasTipo);

  const zip = new JSZip();
  for (const doc of documentosDoLote) {
    const associado = associadosPorId.get(doc.associadoId);
    const pastaAssociado = nomeArquivoSeguro(associado?.nome || doc.associadoId);
    try {
      const url = await getStorageProvider().criarUrlDownload(doc.storageKey, URL_STORAGE_EXPIRA_SEGUNDOS);
      const resposta = await fetch(resolverUrlAbsoluta(url));
      if (!resposta.ok) throw new Error(`status ${resposta.status}`);
      const bytes = await resposta.arrayBuffer();
      zip.file(`${pastaAssociado}/${doc.tipo}.${extensaoPorMime(doc.mimeType)}`, bytes);
    } catch (err) {
      console.error(`[gerarZipDocumentosLote] falha ao baixar documento ${doc.id} (${doc.tipo}):`, err);
    }
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const sufixo = apenasTipo === 'ficha_associativa' ? 'fichas_associativas' : 'documentos';
  return { buffer, nomeArquivo: `${sufixo}_${nomeArquivoSeguro(loteRow.nome)}.zip` };
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
          await registrarCustoApi('whatsapp_zapi', 'enviar_texto', loteId);
          whatsappEnviadoPara += 1;
        } catch (err) {
          console.error(`[encerrarLote] falha ao enviar WhatsApp de encerramento para ${telefone}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('[encerrarLote] falha ao processar aviso de WhatsApp:', err);
  }

  // Sem parceiroId: encerramento de lote é global, todo parceiro com nome
  // ali dentro precisa ver o card de "Minhas Listas" mudar de status na hora.
  emitirEvento({ categoria: 'lotes' });

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
  buscarUsuarioPorId,
  listarUsuarios,
  setUsuarioAtivo,
  autenticarUsuario,
  registrarParceiro,
  alterarSenha,
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
  parseArquivoImportacao,
  lerDocumentosOcrParaImportacao,
  importarRegistros,
  transitionStatus,
  revealDocument,
  revealAssociadoCpf,
  updateAssociadoStatus,
  updateLote,
  createLote,
  encerrarLote,
  attachComprovante,
  getContestacoes,
  createContestacao,
  iniciarMonitoramentoProcesso,
  processarWebhookMonitoramentoProcesso,
  reconciliarMonitoramentoPendente,
  getMovimentacoesProcesso,
  reconciliarBureauPendente,
  carregarCredenciaisIntegracaoCache,
  listarStatusCredenciais,
  salvarCredencialIntegracao,
  revelarCredencialIntegracao,
  obterGastoApiPorProvider,
  getServicos,
  createServico,
  dispararMarketingServico,
  getMarketingLog,
  getMarketingCronograma,
  setMarketingCronogramaDia,
  rodarMarketingCronogramaDoDia,
  getMarketingGrupoConfig,
  setMarketingGrupoConfig,
  getMensagensExtra,
  createMensagemExtra,
  updateMensagemExtra,
  deleteMensagemExtra,
  getChamadasConfig,
  createChamadaConfig,
  updateChamadaConfig,
  deleteChamadaConfig,
  getChamadasLog,
  testarChamada,
  rodarFollowUpLigacoes,
  updateServico,
  deleteServico,
  getDashboardExtra,
  getConfiguracaoEmpresa,
  setConfiguracaoEmpresa,
  getContratos,
  addContrato,
  deleteContrato,
  getComprovante,
  gerarPlanilhaLoteBuffer,
  gerarZipDocumentosLote,
  getStatusOrgaosPorParceiro,
  getNadaConstaPorParceiro,
  marcarOrgaoBaixado,
  getEventosNoticias,
  createEventoNoticia,
  updateEventoNoticia,
  deleteEventoNoticia,
  confirmarPagamentoPixWebhook,
  reconciliarPixPendentes,
  getPixCobrancaPorSubmissao,
  getAutomacoesConfig,
  setAutomacaoConfig,
  getNotificacoesLog,
  previewDocumentos,
  presignDocumentoUpload,
  presignStagingUpload,
  lerDocumentosOcr,
  confirmarDocumentoUpload,
  gerarFichaAssociativaAutomatica,
  getDocumentosStatus,
  getDocumentoDownloadUrl,
};
