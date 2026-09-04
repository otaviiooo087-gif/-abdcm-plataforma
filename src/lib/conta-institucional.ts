/**
 * Identidade financeira institucional da ABDCM, exibida no console admin
 * (razão social, CNPJ, chave PIX e bancos onde a conta está aberta).
 *
 * Não é credencial (I10): é informação pública de identificação da conta,
 * do mesmo tipo que já aparece em um comprovante bancário. Ajustar aqui
 * quando a conta real da associação estiver definida.
 */
export const CONTA_INSTITUCIONAL = {
  razaoSocial: 'Associação Brasileira de Defesa do Consumidor e do Trabalhador',
  cnpj: '45.892.124/0001-90',
  chavePix: 'financeiro@abdcm.org.br',
  bancos: 'Santander (033) & Nu Pagamentos',
} as const
