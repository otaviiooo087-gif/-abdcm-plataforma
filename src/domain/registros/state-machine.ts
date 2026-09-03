/**
 * Máquina de estados do registro — domínio puro.
 *
 * Este módulo não conhece banco, HTTP nem framework. É a única autoridade
 * sobre quais transições de status existem.
 *
 * Invariante I2: toda transição de status grava um ProcessEvent imutável.
 * A garantia aqui é estrutural, não disciplinar: `aplicarTransicao` devolve o
 * novo status **junto com** o evento a gravar, num único objeto. Não existe
 * função neste módulo que devolva um status novo sem o evento correspondente,
 * e a camada de persistência (ver src/store) só aceita gravar o par.
 */

export const PROCESS_STATUSES = [
  'pendente',
  'enviado',
  'aguardando_pagamento',
  'pago',
  'reprovado',
  'aguardando_protocolo',
  'protocolado',
  'baixado',
  'recusado',
  'cancelado',
] as const

export type ProcessStatus = (typeof PROCESS_STATUSES)[number]

/** Rótulos de negócio dos oito status + os dois de exceção. */
export const STATUS_LABELS: Record<ProcessStatus, string> = {
  pendente: 'Registro cadastrado, aguardando envio da lista',
  enviado: 'Lista enviada, aguardando pagamento',
  aguardando_pagamento: 'Pagamento em análise (comprovante manual ou divergência)',
  pago: 'Pagamento confirmado, entra em processamento',
  reprovado: 'Problema com o pagamento — precisa reenviar',
  aguardando_protocolo: 'Registro sendo preparado para protocolo',
  protocolado: 'Protocolado junto aos birôs, em processamento',
  baixado: 'Processo finalizado com sucesso',
  recusado: 'Recusado pelo birô',
  cancelado: 'Cancelado por exceção administrativa',
}

export const TRANSICOES = [
  'enviar_lista',
  'webhook_pix_confirmado',
  'comprovante_manual_anexado',
  'aprovado',
  'rejeitado',
  'novo_comprovante',
  'automatico',
  'protocolo_registrado',
  'retorno_baixado',
  'retorno_recusado',
  'excecao_admin',
] as const

export type Transicao = (typeof TRANSICOES)[number]

export type AtorTipo = 'parceiro' | 'admin' | 'system' | 'integracao'

type Regra = { de: ProcessStatus[] | 'qualquer'; para: ProcessStatus; exigeMotivo?: boolean }

/**
 * Tabela declarativa das transições permitidas. Toda transição não listada
 * aqui é proibida e falha com TransicaoProibidaError.
 */
export const REGRAS: Record<Transicao, Regra> = {
  enviar_lista: { de: ['pendente'], para: 'enviado' },
  webhook_pix_confirmado: { de: ['enviado'], para: 'pago' },
  comprovante_manual_anexado: { de: ['enviado', 'reprovado'], para: 'aguardando_pagamento' },
  aprovado: { de: ['aguardando_pagamento'], para: 'pago' },
  rejeitado: { de: ['aguardando_pagamento'], para: 'reprovado', exigeMotivo: true },
  novo_comprovante: { de: ['reprovado'], para: 'aguardando_pagamento' },
  automatico: { de: ['pago'], para: 'aguardando_protocolo' },
  protocolo_registrado: { de: ['aguardando_protocolo'], para: 'protocolado' },
  retorno_baixado: { de: ['protocolado'], para: 'baixado' },
  retorno_recusado: { de: ['protocolado'], para: 'recusado', exigeMotivo: true },
  excecao_admin: { de: 'qualquer', para: 'cancelado', exigeMotivo: true },
}

export class TransicaoProibidaError extends Error {
  constructor(
    readonly de: ProcessStatus,
    readonly transicao: Transicao,
  ) {
    super(`Transição proibida: "${transicao}" não é permitida a partir de "${de}".`)
    this.name = 'TransicaoProibidaError'
  }
}

export class MotivoObrigatorioError extends Error {
  constructor(readonly transicao: Transicao) {
    super(`A transição "${transicao}" exige reason_code e observação (invariante I11).`)
    this.name = 'MotivoObrigatorioError'
  }
}

/** Evento imutável gravado a cada transição de status (invariante I2). */
export type ProcessEvent = {
  registroId: string
  tenantId: string
  deStatus: ProcessStatus
  paraStatus: ProcessStatus
  atorTipo: AtorTipo
  atorUserId: string | null
  transicao: Transicao
  reasonCode: string | null
  motivo: string | null
  metadata: Record<string, unknown>
  ocorridoEm: Date
}

/** Resultado indivisível: o novo status só existe acompanhado do seu evento. */
export type ResultadoTransicao = {
  readonly paraStatus: ProcessStatus
  readonly evento: ProcessEvent
}

export type EntradaTransicao = {
  registroId: string
  tenantId: string
  de: ProcessStatus
  transicao: Transicao
  atorTipo: AtorTipo
  atorUserId?: string | null
  reasonCode?: string | null
  motivo?: string | null
  metadata?: Record<string, unknown>
  agora?: Date
}

export function podeTransicionar(de: ProcessStatus, transicao: Transicao): boolean {
  const regra = REGRAS[transicao]
  if (!regra) return false
  if (regra.de === 'qualquer') return de !== regra.para
  return regra.de.includes(de)
}

export function transicoesDisponiveis(de: ProcessStatus): Transicao[] {
  return TRANSICOES.filter((t) => podeTransicionar(de, t))
}

/**
 * Aplica uma transição. Devolve o novo status e o ProcessEvent, sempre juntos.
 * Lança TransicaoProibidaError se a transição não existir a partir do status atual.
 */
export function aplicarTransicao(entrada: EntradaTransicao): ResultadoTransicao {
  const regra = REGRAS[entrada.transicao]
  if (!regra || !podeTransicionar(entrada.de, entrada.transicao)) {
    throw new TransicaoProibidaError(entrada.de, entrada.transicao)
  }
  if (regra.exigeMotivo && !(entrada.reasonCode && entrada.motivo)) {
    throw new MotivoObrigatorioError(entrada.transicao)
  }

  const evento: ProcessEvent = {
    registroId: entrada.registroId,
    tenantId: entrada.tenantId,
    deStatus: entrada.de,
    paraStatus: regra.para,
    atorTipo: entrada.atorTipo,
    atorUserId: entrada.atorUserId ?? null,
    transicao: entrada.transicao,
    reasonCode: entrada.reasonCode ?? null,
    motivo: entrada.motivo ?? null,
    metadata: entrada.metadata ?? {},
    ocorridoEm: entrada.agora ?? new Date(),
  }

  return Object.freeze({ paraStatus: regra.para, evento })
}
