/**
 * Tipos de domínio fundamentais da Plataforma ABDCM
 * Conforme especificação técnica e CLAUDE.md
 */

// Os 8 status de processo do negócio + status de exceção
export type ProcessStatus =
  | 'pendente'
  | 'enviado'
  | 'aguardando_pagamento'
  | 'pago'
  | 'reprovado'
  | 'aguardando_protocolo'
  | 'protocolado'
  | 'baixado'
  | 'recusado'
  | 'cancelado';

export type LoteStatus =
  | 'rascunho'
  | 'aberto'
  | 'encerrado'
  | 'em_protocolo'
  | 'protocolado'
  | 'concluido';

export type StatusFiliacao =
  | 'pre_cadastro'
  | 'ficha_enviada'
  | 'ficha_assinada'
  | 'ativo'
  | 'inativo';

export type PaymentStatus =
  | 'pendente'
  | 'pago'
  | 'expirado'
  | 'reprovado'
  | 'cancelado';

// Os 6 papéis com separação estrita de funções (4.2)
export type UserRole =
  | 'parceiro'
  | 'conciliador'
  | 'operador'
  | 'suporte'
  | 'financeiro'
  | 'administrador';

export type AtorTipo = 'parceiro' | 'admin' | 'system' | 'integracao';

export type DocumentType = 'cpf' | 'cnpj';

// I2: ProcessEvent Imutável
export interface ProcessEvent {
  id: string;
  tenant_id: string;
  registro_id: string;
  de_status: ProcessStatus | null;
  para_status: ProcessStatus;
  ator_tipo: AtorTipo;
  ator_user_id: string;
  motivo: string;
  metadata?: Record<string, unknown>;
  ocorrido_em: string;
}

// Registro individual
export interface Registro {
  id: string;
  tenant_id: string;
  lote_id: string;
  parceiro_id: string;
  associado_id: string;
  submissao_id?: string | null;
  nome: string;
  cpf_cnpj_raw: string;
  cpf_cnpj: string; // mascarado
  tipo_documento: DocumentType;
  process_status: ProcessStatus;
  is_locked: boolean;
  observacoes_internas?: string | null;
  unit_price: number; // centavos congelados
  is_bonus: boolean;
  protocol_code?: string | null;
  reprotocol_of_registro_id?: string | null;
  origem: 'manual' | 'planilha' | 'reprotocolo' | 'bonus';
  enviado_em?: string | null;
  protocolado_em?: string | null;
  baixado_em?: string | null;
  created_at: string;
  updated_at: string;
}

// Lote (Ação Coletiva)
export interface Lote {
  id: string;
  tenant_id: string;
  nome: string; // ex: "AÇÃO COLETIVA 124"
  codigo?: string; // ex: "AC 124"
  numero_sequencial: number;
  status: LoteStatus;
  abre_em: string;
  closes_at: string;
  deadline_time: string;
  preco_por_nome: number; // centavos
  bureaus: string[];
  referencia_protocolo?: string | null;
  numero_processo?: string | null;
  vara_tribunal?: string | null;
  juiz?: string | null;
  data_protocolo?: string | null;
  data_distribuicao?: string | null;
  liminar_status?: string | null;
  concluido_em?: string | null;
  created_at: string;
}

// Associado
export interface Associado {
  id: string;
  tenant_id: string;
  parceiro_id: string;
  nome: string;
  cpf_cnpj_raw: string;
  cpf_cnpj: string;
  tipo_documento: DocumentType;
  telefone_whatsapp: string;
  email?: string | null;
  status_filiacao: StatusFiliacao;
  filiado_em?: string | null;
  consentimento_em?: string | null;
  consentimento_ip?: string | null;
  consentimento_hash?: string | null;
  ficha_documento_id?: string | null;
  created_at: string;
}

// Submissão (unidade de cobrança pré-paga)
export interface Submissao {
  id: string;
  tenant_id: string;
  parceiro_id: string;
  lote_id: string;
  nomes_count: number;
  valor_total: number; // centavos
  payment_status: PaymentStatus;
  submetido_em: string;
  confirmado_em?: string | null;
  revisado_por_user_id?: string | null;
  reason_code?: string | null;
  motivo_observacao?: string | null;
}

// Auditoria imutável
export interface AuditLog {
  id: string;
  tenant_id: string;
  ator_user_id: string;
  acao: string;
  entidade_tipo: string;
  entidade_id: string;
  antes?: Record<string, unknown> | null;
  depois?: Record<string, unknown> | null;
  ip: string;
  user_agent: string;
  ocorrido_em: string;
}
