import type { PixProvider } from './PixProvider.js';
import { MockPixProvider } from './MockPixProvider.js';
import { AsaasPixProvider } from './AsaasPixProvider.js';

export * from './PixProvider.js';

let instancia: PixProvider | null = null;

/** true quando o provedor real está configurado (chave presente) — usado pela UI de Configurações. */
export function pixProviderConfigurado(): boolean {
  return process.env.PIX_PROVIDER === 'real' && Boolean(process.env.ASAAS_API_KEY);
}

export function getPixProvider(): PixProvider {
  if (instancia) return instancia;
  instancia = pixProviderConfigurado() ? new AsaasPixProvider() : new MockPixProvider();
  return instancia;
}
