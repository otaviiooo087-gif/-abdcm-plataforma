/**
 * Cache em memória das credenciais de integração já decifradas, carregado
 * do banco na subida do servidor (store.ts) e atualizado a cada
 * salvarCredencialIntegracao(). Fica em módulo isolado, sem depender de
 * db/schema, pra `src/integrations/*` poder ler daqui sem criar
 * dependência circular com `src/server/store.ts` (que é quem importa os
 * integrations/* hoje).
 */

const cache = new Map<string, Record<string, string>>();

export function definirCredencialCache(provider: string, valores: Record<string, string>): void {
  cache.set(provider, valores);
}

export function limparCredencialCache(provider: string): void {
  cache.delete(provider);
}

/** Valor salvo no banco pra essa chave, ou undefined se não configurada — quem chama decide o fallback pro env var. */
export function obterValorCredencial(provider: string, chave: string): string | undefined {
  return cache.get(provider)?.[chave];
}
