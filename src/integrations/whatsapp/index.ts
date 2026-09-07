import type { WhatsAppProvider } from './WhatsAppProvider.js';
import { MockWhatsAppProvider } from './MockWhatsAppProvider.js';
import { ZApiWhatsAppProvider } from './ZApiWhatsAppProvider.js';

export * from './WhatsAppProvider.js';

let instancia: WhatsAppProvider | null = null;

export function whatsAppProviderConfigurado(): boolean {
  return (
    process.env.WHATSAPP_PROVIDER === 'real' &&
    Boolean(process.env.ZAPI_INSTANCE_ID) &&
    Boolean(process.env.ZAPI_TOKEN)
  );
}

export function getWhatsAppProvider(): WhatsAppProvider {
  if (instancia) return instancia;
  instancia = whatsAppProviderConfigurado() ? new ZApiWhatsAppProvider() : new MockWhatsAppProvider();
  return instancia;
}
