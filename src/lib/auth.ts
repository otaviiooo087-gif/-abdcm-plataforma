import 'server-only'
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { ROLES, type Role } from './authz'

/**
 * Sessão resolvida exclusivamente no servidor (invariante I1).
 * O cookie carrega apenas o payload assinado; nenhuma decisão de permissão
 * é tomada no cliente.
 */

const COOKIE = 'abdcm_sessao'
const MAX_AGE = 60 * 60 * 8

function segredo(): string {
  const s = process.env.SESSION_SECRET
  if (s && s.length >= 16) return s
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SESSION_SECRET ausente. Rode "npm run setup" para gerar um .env.local ' +
        'ou defina a variável no ambiente (invariante I10 — nenhum segredo no repositório).',
    )
  }
  // Desenvolvimento: segredo efêmero, regenerado a cada boot. Nunca versionado.
  const g = globalThis as { __abdcmDevSecret?: string }
  g.__abdcmDevSecret ??= randomBytes(32).toString('hex')
  return g.__abdcmDevSecret
}

export type Sessao = {
  userId: string
  tenantId: string
  role: Role
  nome: string
  email: string
  parceiroId: string | null
  /** Impersonação ativa: sessão de admin vendo o portal como parceiro. */
  impersonandoParceiroId?: string | null
  expiraEm: number
}

function assinar(payload: string): string {
  return createHmac('sha256', segredo()).update(payload).digest('base64url')
}

function serializar(s: Sessao): string {
  const payload = Buffer.from(JSON.stringify(s)).toString('base64url')
  return `${payload}.${assinar(payload)}`
}

function desserializar(token: string): Sessao | null {
  const [payload, assinatura] = token.split('.')
  if (!payload || !assinatura) return null
  const esperada = assinar(payload)
  const a = Buffer.from(assinatura)
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Sessao
    if (!ROLES.includes(s.role)) return null
    if (s.expiraEm < Date.now()) return null
    return s
  } catch {
    return null
  }
}

export function hashSenha(senha: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(senha, salt, 64).toString('hex')}`
}

export function conferirSenha(senha: string, hash: string): boolean {
  const [salt, esperado] = hash.split(':')
  if (!salt || !esperado) return false
  const calculado = scryptSync(senha, salt, 64).toString('hex')
  const a = Buffer.from(calculado)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function abrirSessao(dados: Omit<Sessao, 'expiraEm'>): Promise<void> {
  const jar = await cookies()
  jar.set(COOKIE, serializar({ ...dados, expiraEm: Date.now() + MAX_AGE * 1000 }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  })
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE)
}

export async function sessaoAtual(): Promise<Sessao | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  return token ? desserializar(token) : null
}
