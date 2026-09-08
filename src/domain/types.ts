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
  /** Opcional — nem todo associado tem telefone coletado ainda (ex.: importado
   * por planilha, sem ficha assinada). Sem telefone, o bot de WhatsApp (I7)
   * simplesmente não funciona pra essa pessoa até alguém completar o cadastro. */
  telefone_whatsapp: string | null;
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
  tem_comprovante?: boolean;
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

export type StatusContestacao = 'aberta' | 'respondida' | 'resolvida' | 'rejeitada';

// Contestação ("Reclame Aqui"): canal de reabertura pós-conclusão do lote.
// Abertura bloqueada até 72h da conclusão (I5-adjacente); SLA de resposta 48h.
export interface Contestacao {
  id: string;
  tenant_id: string;
  parceiro_id: string;
  lote_id: string;
  registro_id?: string | null;
  motivo: string;
  observacao?: string | null;
  status: StatusContestacao;
  aberta_em: string;
  sla_vence_em: string;
  resolvido_em?: string | null;
}

// Serviço do catálogo — configurado pelo admin, exibido ao parceiro.
export interface Servico {
  id: string;
  tenant_id: string;
  nome: string;
  descricao?: string | null;
  preco: number; // centavos
  prazo_dias: number;
  usa_listas: boolean; // funciona como a Ação Coletiva (com envio de listas) ou não
  ativo: boolean;
  foto_url?: string | null;
  link_redirecionamento?: string | null;
  created_at: string;
}

// Contrato-modelo que o admin disponibiliza aos associados/parceiros.
export interface Contrato {
  id: string;
  tenant_id: string;
  titulo: string;
  nome_arquivo: string;
  mime_type: string;
  conteudo_base64: string;
  atualizado_em: string;
}

export type PixCobrancaStatus = 'pendente' | 'pago' | 'expirado' | 'cancelado';

// Cobrança PIX real emitida pelo provedor (Asaas) ou simulada (mock) para uma submissão.
export interface PixCobranca {
  id: string;
  tenant_id: string;
  submissao_id: string;
  provider: string;
  txid: string;
  qr_code_base64?: string | null;
  copia_e_cola: string;
  valor: number; // centavos
  status: PixCobrancaStatus;
  expira_em: string;
  criado_em: string;
  confirmado_em?: string | null;
}

// Tipos de aviso automático de WhatsApp — cada um vira uma linha configurável na aba Automações.
// "lote_encerrado" é o único que avisa a equipe ABDCM (números configuráveis
// em config.numeros), não associados — disparado ao encerrar uma Ação Coletiva.
export type TipoNotificacao =
  | 'proximo_lote'
  | 'follow_up_lista'
  | 'status_processo'
  | 'pagamento_pendente'
  | 'lote_encerrado';

// Registro de envio (log + chave de deduplicação do motor de automação).
export interface NotificacaoEnviada {
  id: string;
  tenant_id: string;
  tipo: TipoNotificacao;
  destinatario_telefone: string;
  associado_id?: string | null;
  referencia_tipo?: string | null;
  referencia_id?: string | null;
  mensagem: string;
  provider_message_id?: string | null;
  status: string;
  enviado_em: string;
}

// Liga/desliga e parâmetros de cada regra de automação, editável na aba Automações.
export interface AutomacaoConfig {
  chave: TipoNotificacao;
  tenant_id: string;
  ativo: boolean;
  config: Record<string, unknown>;
  atualizado_em: string;
}

export type TipoEventoNoticia = 'evento' | 'noticia';

export interface EventoNoticia {
  id: string;
  tenant_id: string;
  tipo: TipoEventoNoticia;
  titulo: string;
  descricao: string;
  categoria: string; // ex.: "Live", "Novo Serviço", "Comunicado" — texto livre do admin
  imagem_url?: string | null;
  link_externo?: string | null; // ex.: link do Zoom, WhatsApp, página do serviço
  data_evento?: string | null; // só relevante pra tipo 'evento'
  ativo: boolean;
  criado_por_user_id: string;
  created_at: string;
}
