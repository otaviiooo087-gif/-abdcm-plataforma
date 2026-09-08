import { AsyncLocalStorage } from 'node:async_hooks'
import type { UserSession } from '../mockData.js'

/**
 * Sessão real do request atual (resolvida do cookie assinado), disponível
 * sem precisar passar `req` por toda a cadeia de chamadas do store. Quando
 * não há cookie válido (ou o papel não tem conta real ainda), fica null e
 * store.getSession() cai no `activeUser` global de demonstração — mantendo
 * o troca-de-papel existente intacto para quem não tem login real.
 */
export const authContext = new AsyncLocalStorage<UserSession | null>()

export function sessaoRealAtual(): UserSession | null {
  return authContext.getStore() ?? null
}
