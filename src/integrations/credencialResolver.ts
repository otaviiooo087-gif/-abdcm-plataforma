import { obterValorCredencial } from '../server/security/credentialsCache.js';

/**
 * Resolve uma credencial: banco tem prioridade (é o "colar e já funciona"
 * da tela de admin, ver src/integrations/credenciaisCatalogo.ts), variável
 * de ambiente é o fallback de sempre. Todo provider real deve ler a chave
 * por aqui, nunca direto de `process.env`, senão uma chave colada na tela
 * fica sem efeito até reiniciar o servidor.
 */
export function valorCredencial(provider: string, chave: string): string | undefined {
  return obterValorCredencial(provider, chave) ?? process.env[chave];
}

/** true quando a chave está presente no banco — presença ali já é o "opt-in"
 * deliberado do admin, sem precisar do flag `_PROVIDER=real` que o caminho
 * por variável de ambiente ainda exige (compatibilidade com o que já roda em produção). */
export function credencialNoBanco(provider: string, chave: string): boolean {
  return Boolean(obterValorCredencial(provider, chave));
}
