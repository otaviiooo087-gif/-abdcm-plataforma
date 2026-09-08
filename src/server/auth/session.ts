import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Sessão real (parceiro/administrador) via cookie assinado (HMAC-SHA256),
 * sem tabela de sessões — não precisa de persistência extra e sobrevive a
 * restart do processo (diferente da variável global activeUser). Se
 * SESSION_SECRET não estiver configurado, gera um segredo efêmero pro
 * processo (sessões não sobrevivem a restart em dev, mas nunca cai num
 * segredo fixo compartilhado — I10).
 */
const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex')
if (!process.env.SESSION_SECRET) {
  console.warn(
    'AVISO: SESSION_SECRET não configurado — usando segredo efêmero. Sessões de login real serão perdidas a cada restart do servidor. Configure SESSION_SECRET em produção.',
  )
}

export const SESSION_COOKIE_NAME = 'abdcm_sessao'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

interface SessionPayload {
  uid: string
  iat: number
  exp: number
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function sign(data: string): string {
  return createHmac('sha256', SESSION_SECRET).update(data).digest('base64url')
}

export function criarTokenSessao(usuarioId: string): string {
  const now = Date.now()
  const payload: SessionPayload = { uid: usuarioId, iat: now, exp: now + SESSION_TTL_MS }
  const encoded = base64UrlEncode(JSON.stringify(payload))
  const assinatura = sign(encoded)
  return `${encoded}.${assinatura}`
}

export function verificarTokenSessao(token: string | undefined | null): { uid: string } | null {
  if (!token) return null
  const [encoded, assinatura] = token.split('.')
  if (!encoded || !assinatura) return null

  const assinaturaEsperada = sign(encoded)
  const a = Buffer.from(assinatura)
  const b = Buffer.from(assinaturaEsperada)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as SessionPayload
    if (typeof payload.uid !== 'string' || typeof payload.exp !== 'number') return null
    if (Date.now() > payload.exp) return null
    return { uid: payload.uid }
  } catch {
    return null
  }
}
