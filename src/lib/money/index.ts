/**
 * Utilitários monetários da ABDCM
 * REGRA FUNDAMENTAL: Dinheiro sempre em centavos inteiros (INTEGER). Nunca float.
 */

export function formatCurrencyBRL(centavos: number): string {
  if (isNaN(centavos) || centavos === null || centavos === undefined) {
    return 'R$ 0,00';
  }
  const reais = centavos / 100;
  return reais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseBRLToCentavos(valorTexto: string): number {
  if (!valorTexto) return 0;
  const limpo = valorTexto.replace(/[^\d,-]/g, '').replace(',', '.');
  const valor = Math.round(parseFloat(limpo) * 100);
  return isNaN(valor) ? 0 : valor;
}

export function sumCentavos(valores: number[]): number {
  return valores.reduce((acc, curr) => acc + Math.trunc(curr || 0), 0);
}
