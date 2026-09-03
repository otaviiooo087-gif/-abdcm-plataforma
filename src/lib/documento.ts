/** CPF/CNPJ: validação de dígito verificador e mascaramento (invariante I6). */

export type TipoDocumento = 'cpf' | 'cnpj'

export function apenasDigitos(v: string): string {
  return v.replace(/\D/g, '')
}

export function tipoDocumento(raw: string): TipoDocumento | null {
  const d = apenasDigitos(raw)
  if (d.length === 11) return 'cpf'
  if (d.length === 14) return 'cnpj'
  return null
}

export function validarCPF(raw: string): boolean {
  const d = apenasDigitos(raw)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const calc = (fim: number) => {
    let soma = 0
    for (let i = 0; i < fim; i++) soma += Number(d[i]) * (fim + 1 - i)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10])
}

export function validarCNPJ(raw: string): boolean {
  const d = apenasDigitos(raw)
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const calc = (fim: number) => {
    let peso = fim - 7
    let soma = 0
    for (let i = 0; i < fim; i++) {
      soma += Number(d[i]) * peso
      peso = peso === 2 ? 9 : peso - 1
    }
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13])
}

export function validarDocumento(raw: string): boolean {
  const tipo = tipoDocumento(raw)
  if (tipo === 'cpf') return validarCPF(raw)
  if (tipo === 'cnpj') return validarCNPJ(raw)
  return false
}

export function formatarDocumento(raw: string): string {
  const d = apenasDigitos(raw)
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  if (d.length === 14)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  return raw
}

/**
 * Máscara padrão de toda tela administrativa (I6): 123.***.**9-00.
 * O valor completo só sai do servidor sob revelação explícita e auditada.
 */
export function mascararDocumento(raw: string): string {
  const d = apenasDigitos(raw)
  if (d.length === 11) return `${d.slice(0, 3)}.***.**${d.slice(8, 9)}-${d.slice(9)}`
  if (d.length === 14) return `${d.slice(0, 2)}.***.***/${d.slice(8, 12)}-${d.slice(12)}`
  return '***'
}

/** Nome parcialmente mascarado para listas administrativas. */
export function mascararNome(nome: string): string {
  return nome
    .split(' ')
    .map((p, i) => (i === 0 || p.length <= 2 ? p : `${p[0]}${'*'.repeat(Math.max(p.length - 1, 1))}`))
    .join(' ')
}
