/** Dinheiro sempre em centavos, inteiro. Nunca float. Nunca. */
export type Centavos = number

export function formatarBRL(centavos: Centavos): string {
  if (!Number.isInteger(centavos)) throw new Error('Valor monetário deve ser inteiro em centavos.')
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function somar(valores: Centavos[]): Centavos {
  return valores.reduce((a, b) => a + b, 0)
}

/**
 * Precedência de preço, resolvida uma única vez no servidor (invariante I4):
 * preço do parceiro → preço do lote → preço padrão do tenant.
 */
export function resolverPrecoUnitario(input: {
  precoParceiro: Centavos | null
  precoLote: Centavos | null
  precoPadraoTenant: Centavos
}): { preco: Centavos; origem: 'parceiro' | 'lote' | 'tenant' } {
  if (input.precoParceiro != null) return { preco: input.precoParceiro, origem: 'parceiro' }
  if (input.precoLote != null) return { preco: input.precoLote, origem: 'lote' }
  return { preco: input.precoPadraoTenant, origem: 'tenant' }
}

/** Reprotocolo: gratuito até 30 dias do envio; depois, percentual do preço unitário. */
export function calcularPrecoReprotocolo(input: {
  precoUnitario: Centavos
  enviadoEm: Date
  agora?: Date
  diasGratuitos?: number
  percentualAposPrazo?: number
}): { preco: Centavos; gratuito: boolean; diasDesdeEnvio: number } {
  const agora = input.agora ?? new Date()
  const dias = Math.floor((agora.getTime() - input.enviadoEm.getTime()) / 86_400_000)
  const limite = input.diasGratuitos ?? 30
  if (dias <= limite) return { preco: 0, gratuito: true, diasDesdeEnvio: dias }
  const pct = input.percentualAposPrazo ?? 85
  return { preco: Math.round((input.precoUnitario * pct) / 100), gratuito: false, diasDesdeEnvio: dias }
}
