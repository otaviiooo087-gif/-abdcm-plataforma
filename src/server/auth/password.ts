import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/**
 * Hash de senha com scrypt (nativo do Node, sem dependência externa).
 * Formato armazenado: scrypt:N:salt-hex:hash-hex
 */
const SCRYPT_N = 16384
const KEY_LEN = 64

export function hashPassword(senha: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(senha, salt, KEY_LEN, { N: SCRYPT_N })
  return `scrypt:${SCRYPT_N}:${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verifyPassword(senha: string, armazenado: string): boolean {
  const partes = armazenado.split(':')
  if (partes.length !== 4 || partes[0] !== 'scrypt') return false
  const n = Number(partes[1])
  const salt = Buffer.from(partes[2]!, 'hex')
  const hashEsperado = Buffer.from(partes[3]!, 'hex')
  const hashCalculado = scryptSync(senha, salt, hashEsperado.length, { N: n })
  return timingSafeEqual(hashCalculado, hashEsperado)
}
