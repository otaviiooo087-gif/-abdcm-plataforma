/**
 * Códigos de motivo de lista fechada (invariante I11).
 *
 * Texto livre opcional não basta: é o código que permite medir qualidade
 * depois — quantas reprovações por comprovante ilegível, quantas por valor
 * divergente, e qual parceiro concentra cada tipo.
 */
export const REASON_CODES_CONCILIACAO = {
  valor_divergente: 'Valor divergente',
  comprovante_ilegivel: 'Comprovante ilegível',
  comprovante_duplicado: 'Comprovante duplicado',
  pagamento_nao_localizado: 'Pagamento não localizado',
  dados_nao_conferem: 'Dados não conferem',
} as const

export type ReasonCodeConciliacao = keyof typeof REASON_CODES_CONCILIACAO
