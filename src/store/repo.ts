import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import {
  aplicarTransicao,
  type EntradaTransicao,
  type ProcessEvent,
  type ProcessStatus,
  type ResultadoTransicao,
} from '@/domain/registros/state-machine'
import { db } from '@/db/client'
import * as t from '@/db/schema'
import type {
  AuditLog,
  Banco,
  Registro,
  StatusPagamento,
} from './schema'

/**
 * Camada de acesso ao Postgres. Substitui o antigo repositório em memória da
 * Fase 0 (o mesmo nome de funções foi mantido de propósito — ver histórico
 * do arquivo — para minimizar o diff nas páginas que já consumiam este
 * módulo). Toda leitura filtra por tenant_id no próprio SQL (invariante I9).
 */

/** Toda leitura já vem filtrada pelo SQL; mantido apenas por compatibilidade de chamada. */
export function doTenant<T extends { tenantId: string }>(linhas: T[], tenantId: string): T[] {
  return linhas.filter((l) => l.tenantId === tenantId)
}

let tenantPadraoCache: string | null = null

/**
 * Resolve o único tenant desta implantação (I9: interface single-tenant,
 * sem seletor visível). Usado só onde ainda não há sessão — login e
 * consulta pública.
 */
async function resolverTenantPadrao(): Promise<string> {
  if (tenantPadraoCache) return tenantPadraoCache
  const [linha] = await db().select({ id: t.tenants.id }).from(t.tenants).limit(1)
  if (!linha) throw new Error('Nenhum tenant encontrado. Rode "npm run db:seed".')
  tenantPadraoCache = linha.id
  return linha.id
}

/** Carrega tudo que este tenant tem, já filtrado no SQL. Uma consulta por tabela. */
export async function banco(tenantId: string): Promise<Banco> {
  const conexao = db()

  const [tenantRow, users, parceiros, associados, lotes, registros, submissoes, pixCobrancas, processEvents, contestacoes, auditRows] =
    await Promise.all([
      conexao.select().from(t.tenants).where(eq(t.tenants.id, tenantId)).limit(1),
      conexao.select().from(t.users).where(eq(t.users.tenantId, tenantId)),
      conexao.select().from(t.parceiros).where(eq(t.parceiros.tenantId, tenantId)),
      conexao.select().from(t.associados).where(eq(t.associados.tenantId, tenantId)),
      conexao.select().from(t.lotes).where(eq(t.lotes.tenantId, tenantId)),
      conexao.select().from(t.registros).where(eq(t.registros.tenantId, tenantId)),
      conexao.select().from(t.submissoes).where(eq(t.submissoes.tenantId, tenantId)),
      conexao.select().from(t.pixCobrancas).where(eq(t.pixCobrancas.tenantId, tenantId)),
      conexao.select().from(t.processEvents).where(eq(t.processEvents.tenantId, tenantId)),
      conexao.select().from(t.contestacoes).where(eq(t.contestacoes.tenantId, tenantId)),
      conexao
        .select({
          id: t.auditLog.id, tenantId: t.auditLog.tenantId, atorUserId: t.auditLog.atorUserId,
          atorNome: t.users.nome, acao: t.auditLog.acao, entidadeTipo: t.auditLog.entidadeTipo,
          entidadeId: t.auditLog.entidadeId, antes: t.auditLog.antes, depois: t.auditLog.depois,
          ip: t.auditLog.ip, ocorridoEm: t.auditLog.ocorridoEm,
        })
        .from(t.auditLog)
        .leftJoin(t.users, eq(t.auditLog.atorUserId, t.users.id))
        .where(eq(t.auditLog.tenantId, tenantId))
        .orderBy(desc(t.auditLog.ocorridoEm)),
    ])

  const config = (tenantRow[0]?.config ?? {}) as { precoPadraoTenant?: number }

  return {
    tenantId,
    precoPadraoTenant: config.precoPadraoTenant ?? 5490,
    users: users as Banco['users'],
    parceiros: parceiros as Banco['parceiros'],
    associados: associados as Banco['associados'],
    lotes: lotes as Banco['lotes'],
    registros: registros as Banco['registros'],
    submissoes: submissoes.map((s) => ({ ...s, valorTotal: s.valorTotal })) as Banco['submissoes'],
    pixCobrancas: pixCobrancas as Banco['pixCobrancas'],
    processEvents: processEvents.map((e) => ({ ...e, metadata: (e.metadata ?? {}) as Record<string, unknown> })) as unknown as ProcessEvent[],
    contestacoes: contestacoes as Banco['contestacoes'],
    auditLog: auditRows.map((a) => ({ ...a, atorNome: a.atorNome ?? '—' })) as AuditLog[],
  }
}

/** Mesma coisa que `banco()`, mas para telas sem sessão (I9: um único tenant nesta implantação). */
export async function bancoTenantPadrao(): Promise<Banco> {
  return banco(await resolverTenantPadrao())
}

export class RegistroBloqueadoError extends Error {
  constructor(id: string) {
    super(`Registro ${id} está bloqueado e não aceita alteração direta.`)
    this.name = 'RegistroBloqueadoError'
  }
}

function efeitosColaterais(para: ProcessStatus, quando: Date) {
  const patch: Partial<typeof t.registros.$inferInsert> = { processStatus: para }
  if (para === 'enviado') { patch.isLocked = true; patch.enviadoEm = quando }
  if (para === 'protocolado') patch.protocoladoEm = quando
  if (para === 'baixado') patch.baixadoEm = quando
  if (para === 'cancelado') patch.isLocked = false
  return patch
}

/**
 * ÚNICO caminho de escrita de process_status em todo o sistema.
 *
 * Delega a decisão à máquina de estados (domínio puro) e grava o novo status
 * e o ProcessEvent na MESMA transação — um não existe no banco sem o outro,
 * o que faz o invariante I2 ser estrutural, não disciplinar.
 */
export async function transicionarRegistro(
  registro: Registro,
  entrada: Omit<EntradaTransicao, 'registroId' | 'tenantId' | 'de'>,
): Promise<ResultadoTransicao> {
  const resultado = aplicarTransicao({
    ...entrada,
    registroId: registro.id,
    tenantId: registro.tenantId,
    de: registro.processStatus,
  })

  await db().transaction(async (tx) => {
    await tx.update(t.registros)
      .set(efeitosColaterais(resultado.paraStatus, resultado.evento.ocorridoEm))
      .where(and(eq(t.registros.id, registro.id), eq(t.registros.tenantId, registro.tenantId)))

    await tx.insert(t.processEvents).values({
      tenantId: resultado.evento.tenantId,
      registroId: resultado.evento.registroId,
      deStatus: resultado.evento.deStatus,
      paraStatus: resultado.evento.paraStatus,
      atorTipo: resultado.evento.atorTipo,
      atorUserId: resultado.evento.atorUserId,
      transicao: resultado.evento.transicao,
      reasonCode: resultado.evento.reasonCode,
      motivo: resultado.evento.motivo,
      metadata: resultado.evento.metadata,
      ocorridoEm: resultado.evento.ocorridoEm,
    })
  })

  // Mantém o objeto já carregado nesta requisição coerente com o banco,
  // para o código que decide o próximo passo no mesmo laço (ver conciliação).
  registro.processStatus = resultado.paraStatus
  if (resultado.paraStatus === 'enviado') { registro.isLocked = true; registro.enviadoEm = resultado.evento.ocorridoEm }
  if (resultado.paraStatus === 'protocolado') registro.protocoladoEm = resultado.evento.ocorridoEm
  if (resultado.paraStatus === 'baixado') registro.baixadoEm = resultado.evento.ocorridoEm
  if (resultado.paraStatus === 'cancelado') registro.isLocked = false

  return resultado
}

/** Avanço automático pago → aguardando_protocolo (zero intervenção humana). */
export async function avancarAposPagamento(registro: Registro): Promise<void> {
  await transicionarRegistro(registro, {
    transicao: 'automatico',
    atorTipo: 'system',
    metadata: { motivo: 'avanço automático após confirmação de pagamento' },
  })
}

/** Atualiza campos da submissão (aprovação/reprovação na conciliação). Só isto escreve em `submissoes`. */
export async function atualizarSubmissao(
  tenantId: string,
  submissaoId: string,
  patch: Partial<{
    paymentStatus: StatusPagamento
    confirmadoEm: Date | null
    motivoExcecao: string | null
    reasonCode: string | null
    motivoObservacao: string | null
  }>,
): Promise<void> {
  await db().update(t.submissoes)
    .set(patch)
    .where(and(eq(t.submissoes.id, submissaoId), eq(t.submissoes.tenantId, tenantId)))
}

export async function eventosDoRegistro(registroId: string): Promise<ProcessEvent[]> {
  const linhas = await db()
    .select()
    .from(t.processEvents)
    .where(eq(t.processEvents.registroId, registroId))
    .orderBy(t.processEvents.ocorridoEm)
  return linhas.map((e) => ({ ...e, metadata: (e.metadata ?? {}) as Record<string, unknown> })) as unknown as ProcessEvent[]
}

/** Log imutável: só append — o banco recusa update e delete por trigger (I6, I11). */
export async function auditar(entrada: Omit<AuditLog, 'id' | 'ocorridoEm' | 'atorNome'>): Promise<void> {
  await db().insert(t.auditLog).values({
    tenantId: entrada.tenantId,
    atorUserId: entrada.atorUserId,
    acao: entrada.acao,
    entidadeTipo: entrada.entidadeTipo,
    entidadeId: entrada.entidadeId,
    antes: entrada.antes as object | null,
    depois: entrada.depois as object | null,
    ip: entrada.ip,
  })
}
