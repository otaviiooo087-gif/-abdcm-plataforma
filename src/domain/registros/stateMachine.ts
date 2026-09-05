/**
 * Máquina de estados pura para transições de status de Registros
 * Garante I1 (regras no servidor) e I2 (ProcessEvent imutável obrigatório)
 */

import { ProcessStatus, ProcessEvent, AtorTipo } from '../types.js';

export class DomainError extends Error {
  public readonly code: string;
  constructor(message: string, code: string = 'DOMAIN_RULE_VIOLATION') {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

// Mapa exato de transições válidas especificadas na Parte 1.3
export const VALID_TRANSITIONS: Record<ProcessStatus, ProcessStatus[]> = {
  pendente: ['enviado', 'cancelado'],
  enviado: ['pago', 'aguardando_pagamento', 'cancelado'],
  aguardando_pagamento: ['pago', 'reprovado', 'cancelado'],
  reprovado: ['aguardando_pagamento', 'cancelado'],
  pago: ['aguardando_protocolo', 'cancelado'],
  aguardando_protocolo: ['protocolado', 'cancelado'],
  protocolado: ['baixado', 'recusado', 'cancelado'],
  baixado: ['cancelado'], // exceção administrativa somente com motivo
  recusado: ['cancelado'],
  cancelado: [], // Estado terminal
};

export interface TransitionInput {
  registroId: string;
  tenantId: string;
  deStatus: ProcessStatus;
  paraStatus: ProcessStatus;
  atorTipo: AtorTipo;
  atorUserId: string;
  motivo: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export interface TransitionResult {
  novoStatus: ProcessStatus;
  processEvent: ProcessEvent;
}

/**
 * Valida a transição e gera o ProcessEvent imutável
 * Lança DomainError para qualquer transição proibida ou falta de motivo em cancelamento
 */
export function transitionProcessStatus(input: TransitionInput): TransitionResult {
  const {
    registroId,
    tenantId,
    deStatus,
    paraStatus,
    atorTipo,
    atorUserId,
    motivo,
    metadata = {},
    timestamp = new Date().toISOString(),
  } = input;

  if (!deStatus) {
    throw new DomainError('Status atual de origem é obrigatório.', 'INVALID_CURRENT_STATUS');
  }

  if (deStatus === paraStatus) {
    throw new DomainError(`Status já se encontra em "${deStatus}".`, 'NOOP_TRANSITION');
  }

  const allowed = VALID_TRANSITIONS[deStatus] || [];
  if (!allowed.includes(paraStatus)) {
    throw new DomainError(
      `Transição de "${deStatus}" para "${paraStatus}" é estritamente proibida pela regra de negócio.`,
      'ILLEGAL_STATUS_TRANSITION'
    );
  }

  // Cancelamento é exceção administrativa e exige obrigatoriamente motivo detalhado
  if (paraStatus === 'cancelado' && (!motivo || motivo.trim().length < 5)) {
    throw new DomainError(
      'Cancelamento administrativo exige justificativa válida com no mínimo 5 caracteres.',
      'REASON_REQUIRED_FOR_CANCELLATION'
    );
  }

  // ProcessEvent imutável garantido por estrutura
  const processEvent: ProcessEvent = {
    id: `pe_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    tenant_id: tenantId,
    registro_id: registroId,
    de_status: deStatus,
    para_status: paraStatus,
    ator_tipo: atorTipo,
    ator_user_id: atorUserId,
    motivo: motivo.trim(),
    metadata,
    ocorrido_em: timestamp,
  };

  return {
    novoStatus: paraStatus,
    processEvent,
  };
}
