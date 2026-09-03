import { describe, expect, it } from 'vitest'
import { mascararDocumento, validarCNPJ, validarCPF, validarDocumento } from './documento'

describe('validação de dígito verificador', () => {
  it('aceita CPF válido, com e sem máscara', () => {
    expect(validarCPF('529.982.247-25')).toBe(true)
    expect(validarCPF('52998224725')).toBe(true)
  })

  it('rejeita CPF com dígito verificador errado', () => {
    expect(validarCPF('529.982.247-26')).toBe(false)
  })

  it('rejeita sequência repetida', () => {
    expect(validarCPF('111.111.111-11')).toBe(false)
  })

  it('aceita CNPJ válido e rejeita inválido', () => {
    expect(validarCNPJ('11.222.333/0001-81')).toBe(true)
    expect(validarCNPJ('11.222.333/0001-82')).toBe(false)
  })

  it('documento com tamanho inesperado é inválido', () => {
    expect(validarDocumento('123')).toBe(false)
  })
})

describe('invariante I6 — máscara padrão', () => {
  it('CPF sai no formato 123.***.**9-00', () => {
    expect(mascararDocumento('12345678900')).toBe('123.***.**9-00')
  })

  it('a máscara não deixa vazar os dígitos do meio', () => {
    const mascarado = mascararDocumento('52998224725')
    expect(mascarado).not.toContain('998')
    expect(mascarado).not.toContain('224')
  })

  it('CNPJ também é mascarado', () => {
    expect(mascararDocumento('11222333000181')).toBe('11.***.***/0001-81')
  })
})
