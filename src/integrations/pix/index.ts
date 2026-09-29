import type { PixProvider } from './PixProvider.js';
import { MockPixProvider } from './MockPixProvider.js';
import { AsaasPixProvider } from './AsaasPixProvider.js';
import { credencialNoBanco } from '../credencialResolver.js';

export * from './PixProvider.js';

let instancia: PixProvider | null = null;
let instanciaEraReal = false;

/** true quando o provedor real está configurado (chave no banco, ou env var) — usado pela UI de Configurações. */
export function pixProviderConfigurado(): boolean {
  if (credencialNoBanco('pix_asaas', 'ASAAS_API_KEY')) return true;
  return process.env.PIX_PROVIDER === 'real' && Boolean(process.env.ASAAS_API_KEY);
}

export function getPixProvider(): PixProvider {
  const real = pixProviderConfigurado();
  if (!instancia || real !== instanciaEraReal) {
    instancia = real ? new AsaasPixProvider() : new MockPixProvider();
    instanciaEraReal = real;
  }
  return instancia;
}
