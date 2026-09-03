import 'server-only'
import {
  aplicarTransicao,
  type EntradaTransicao,
  type ProcessEvent,
  type ProcessStatus,
  type ResultadoTransicao,
} from '@/domain/registros/state-machine'
import { hashSenha } from '@/lib/auth'
import type { AuditLog, Banco, Registro } from './schema'
import { seed } from './seed'

/** Repositório em memória da Fase 0. O schema SQL equivalente está em src/db/schema.sql. */
const g = globalThis as { __abdcmBanco?: Banco }
export function banco(): Banco {
  g.__abdcmBanco ??= seed(hashSenha)
  return g.__abdcmBanco
}

/** Toda leitura é filtrada por tenant_id (invariante I9). */
export function doTenant<T extends { tenantId: string }>(linhas: T[], tenantId: string): T[] {
  return linhas.filter((l) => l.tenantId === tenantId)
}

export class RegistroBloqueadoError extends Error {
  constructor(id: string) {
    super(`Registro ${id} está bloqueado e não aceita alteração direta.`)
    this.name = 'RegistroBloqueadoError'
  }
}

/**
 * ÚNICO caminho de escrita de process_status em todo o sistema.
 *
 * Recebe a entrada da transição, delega a decisão à máquina de estados (domínio
 * puro) e grava status e ProcessEvent na mesma operação. Não existe função
 * exportada que altere `processStatus` sem passar por aqui — é assim que o
 * invariante I2 vira estrutura em vez de disciplina.
 */
export function transicionarRegistro(
  registro: Registro,
  entrada: Omit<EntradaTransicao, 'registroId' | 'tenantId' | 'de'>,
): ResultadoTransicao {
  const resultado = aplicarTransicao({
    ...entrada,
    registroId: registro.id,
    tenantId: registro.tenantId,
    de: registro.processStatus,
  })

  // status e evento são gravados juntos; um não existe sem o outro.
  registro.processStatus = resultado.paraStatus
  banco().processEvents.push(resultado.evento)
  aplicarEfeitosColaterais(registro, resultado.paraStatus, resultado.evento)
  return resultado
}

function aplicarEfeitosColaterais(r: Registro, para: ProcessStatus, e: ProcessEvent): void {
  if (para === 'enviado') {
    r.isLocked = true
    r.enviadoEm = e.ocorridoEm
  }
  if (para === 'protocolado') r.protocoladoEm = e.ocorridoEm
  if (para === 'baixado') r.baixadoEm = e.ocorridoEm
  if (para === 'cancelado') r.isLocked = false
}

/** Avanço automático pago → aguardando_protocolo (zero intervenção humana). */
export function avancarAposPagamento(registro: Registro): void {
  transicionarRegistro(registro, {
    transicao: 'automatico',
    atorTipo: 'system',
    metadata: { motivo: 'avanço automático após confirmação de pagamento' },
  })
}

export function eventosDoRegistro(registroId: string): ProcessEvent[] {
  return banco()
    .processEvents.filter((e) => e.registroId === registroId)
    .sort((a, b) => a.ocorridoEm.getTime() - b.ocorridoEm.getTime())
}

/** Log imutável: só append, nunca update nem delete (I6, I11). */
export function auditar(entrada: Omit<AuditLog, 'id' | 'ocorridoEm'>): void {
  banco().auditLog.push({
    ...entrada,
    id: `audit-${banco().auditLog.length + 1}`,
    ocorridoEm: new Date(),
  })
}

export function auditoria(tenantId: string): AuditLog[] {
  return doTenant(banco().auditLog, tenantId).sort(
    (a, b) => b.ocorridoEm.getTime() - a.ocorridoEm.getTime(),
  )
}
