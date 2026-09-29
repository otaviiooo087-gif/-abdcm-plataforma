import type { WhatsAppProvider } from './WhatsAppProvider.js';
import { MockWhatsAppProvider } from './MockWhatsAppProvider.js';
import { ZApiWhatsAppProvider } from './ZApiWhatsAppProvider.js';
import { credencialNoBanco } from '../credencialResolver.js';

export * from './WhatsAppProvider.js';

let instancia: WhatsAppProvider | null = null;
let instanciaEraReal = false;

export function whatsAppProviderConfigurado(): boolean {
  if (credencialNoBanco('whatsapp_zapi', 'ZAPI_INSTANCE_ID') && credencialNoBanco('whatsapp_zapi', 'ZAPI_TOKEN')) {
    return true;
  }
  return (
    process.env.WHATSAPP_PROVIDER === 'real' &&
    Boolean(process.env.ZAPI_INSTANCE_ID) &&
    Boolean(process.env.ZAPI_TOKEN)
  );
}

export function getWhatsAppProvider(): WhatsAppProvider {
  const real = whatsAppProviderConfigurado();
  if (!instancia || real !== instanciaEraReal) {
    instancia = real ? new ZApiWhatsAppProvider() : new MockWhatsAppProvider();
    instanciaEraReal = real;
  }
  return instancia;
}
