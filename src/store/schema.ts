import type { ProcessEvent, ProcessStatus } from '@/domain/registros/state-machine'
import type { Role } from '@/lib/authz'
import type { Centavos } from '@/lib/money'

/**
 * Formato dos dados em memória. Espelha o schema SQL de src/db/schema.sql,
 * inclusive o tenant_id obrigatório em toda entidade de domínio (invariante I9).
 */

export type StatusFiliacao = 'pre_cadastro' | 'ficha_enviada' | 'ficha_assinada' | 'ativo' | 'inativo'
export type StatusLote = 'rascunho' | 'aberto' | 'encerrado' | 'em_protocolo' | 'protocolado' | 'concluido'
export type StatusPagamento = 'pendente' | 'pago' | 'expirado' | 'reprovado' | 'cancelado'

export type User = {
  id: string
  tenantId: string
  email: string
  passwordHash: string
  role: Role
  nome: string
  isActive: boolean
  parceiroId: string | null
}

export type Parceiro = {
  id: string
  tenantId: string
  userId: string
  nomeCompleto: string
  nomeExibicao: string
  cpfCnpj: string
  whatsapp: string
  cidade: string
  uf: string
  partnerCode: string
  precoPorNome: Centavos | null
  totalNomesEnviados: number
  isActive: boolean
}

export type Associado = {
  id: string
  tenantId: string
  parceiroId: string
  nome: string
  cpfCnpj: string
  tipoDocumento: 'cpf' | 'cnpj'
  telefoneWhatsapp: string
  email: string
  statusFiliacao: StatusFiliacao
  filiadoEm: Date | null
  consentimentoEm: Date | null
  consentimentoIp: string | null
  consentimentoHash: string | null
}

export type Lote = {
  id: string
  tenantId: string
  nome: string
  numeroSequencial: number
  status: StatusLote
  abreEm: Date
  closesAt: Date
  precoPorNome: Centavos
  bureaus: string[]
  referenciaProtocolo: string | null
  concluidoEm: Date | null
}

export type Registro = {
  id: string
  tenantId: string
  loteId: string
  parceiroId: string
  associadoId: string
  submissaoId: string | null
  nome: string
  cpfCnpj: string
  processStatus: ProcessStatus
  isLocked: boolean
  /** Congelado no envio, imutável depois (invariante I4). */
  unitPrice: Centavos
  isBonus: boolean
  protocolCode: string | null
  reprotocolOfRegistroId: string | null
  origem: 'manual' | 'planilha' | 'reprotocolo' | 'bonus'
  enviadoEm: Date | null
  protocoladoEm: Date | null
  baixadoEm: Date | null
}

export type Submissao = {
  id: string
  tenantId: string
  parceiroId: string
  loteId: string
  nomesCount: number
  valorTotal: Centavos
  paymentStatus: StatusPagamento
  submetidoEm: Date
  confirmadoEm: Date | null
  reasonCode: string | null
  motivoObservacao: string | null
  /** Motivo pelo qual caiu na fila de exceção; null = caminho feliz. */
  motivoExcecao: string | null
  valorIdentificado: Centavos | null
  comprovanteManual: boolean
}

export type PixCobranca = {
  id: string
  tenantId: string
  submissaoId: string
  provider: string
  txid: string
  valor: Centavos
  copiaECola: string
  expiraEm: Date
  status: StatusPagamento
  pagoEm: Date | null
}

export type Contestacao = {
  id: string
  tenantId: string
  parceiroId: string
  loteId: string
  registroId: string
  reasonCode: string
  descricao: string
  status: 'aberta' | 'respondida' | 'resolvida' | 'rejeitada'
  abertaEm: Date
  slaVenceEm: Date
  resolvidoEm: Date | null
}

export type AuditLog = {
  id: string
  tenantId: string
  atorUserId: string
  atorNome: string
  acao: string
  entidadeTipo: string
  entidadeId: string
  antes: unknown
  depois: unknown
  ip: string
  ocorridoEm: Date
}

export type Banco = {
  tenantId: string
  precoPadraoTenant: Centavos
  users: User[]
  parceiros: Parceiro[]
  associados: Associado[]
  lotes: Lote[]
  registros: Registro[]
  submissoes: Submissao[]
  pixCobrancas: PixCobranca[]
  processEvents: ProcessEvent[]
  contestacoes: Contestacao[]
  auditLog: AuditLog[]
}
