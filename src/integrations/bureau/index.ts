import type { BureauProvider } from './BureauProvider.js';
import { MockBureauProvider } from './MockBureauProvider.js';
import { SerasaBureauProvider } from './SerasaBureauProvider.js';
import { credencialNoBanco } from '../credencialResolver.js';

export * from './BureauProvider.js';

let instancia: BureauProvider | null = null;
let instanciaEraReal = false;

/** true quando o provedor real está configurado (chave no banco, ou env var) — usado pela UI de Configurações. */
export function bureauProviderConfigurado(): boolean {
  if (credencialNoBanco('bureau_serasa', 'SERASA_CLIENT_ID') && credencialNoBanco('bureau_serasa', 'SERASA_CLIENT_SECRET')) {
    return true;
  }
  return (
    process.env.BUREAU_PROVIDER === 'real' &&
    Boolean(process.env.SERASA_CLIENT_ID) &&
    Boolean(process.env.SERASA_CLIENT_SECRET)
  );
}

export function getBureauProvider(): BureauProvider {
  const real = bureauProviderConfigurado();
  if (!instancia || real !== instanciaEraReal) {
    instancia = real ? new SerasaBureauProvider() : new MockBureauProvider();
    instanciaEraReal = real;
  }
  return instancia;
}
