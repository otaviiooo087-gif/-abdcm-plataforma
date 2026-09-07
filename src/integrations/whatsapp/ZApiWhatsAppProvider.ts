import type { WhatsAppProvider, EnviarTextoInput, EnvioResultado, MensagemRecebida } from './WhatsAppProvider.js';

// Integração real com a Z-API (https://developer.z-api.io) — API
// não-oficial de WhatsApp, escolhida por não depender de homologação da
// Meta. Implementado a partir da documentação pública e estável da
// Z-API, mas nunca testado contra uma instância real — este ambiente não
// tem acesso de rede pra api.z-api.io. Valide o envio de uma mensagem de
// teste antes de habilitar em produção.
//
// Auth: a instância + token vão na própria URL; o "Client-Token" (token
// de segurança da conta, diferente do token da instância) vai no header.
// Env vars: ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN.

function baseUrl(): string {
  const instancia = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  if (!instancia || !token) {
    throw new Error('ZAPI_INSTANCE_ID/ZAPI_TOKEN ausentes — configure as variáveis de ambiente.');
  }
  return `https://api.z-api.io/instances/${instancia}/token/${token}`;
}

export class ZApiWhatsAppProvider implements WhatsAppProvider {
  async enviarTexto(input: EnviarTextoInput): Promise<EnvioResultado> {
    const clientToken = process.env.ZAPI_CLIENT_TOKEN;
    const telefoneLimpo = input.telefone.replace(/\D/g, '');

    const res = await fetch(`${baseUrl()}/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(clientToken ? { 'Client-Token': clientToken } : {}),
      },
      body: JSON.stringify({ phone: telefoneLimpo, message: input.texto }),
    });

    if (!res.ok) {
      const corpo = await res.text().catch(() => '');
      throw new Error(`Z-API send-text falhou (${res.status}): ${corpo.slice(0, 300)}`);
    }

    const data = (await res.json()) as { messageId?: string; zaapId?: string };
    return { id: data.messageId ?? data.zaapId ?? `zapi_${Date.now()}` };
  }

  async validarWebhook(payload: unknown): Promise<MensagemRecebida> {
    const body = payload as {
      phone?: string;
      text?: { message?: string };
      momment?: number;
    };
    if (!body?.phone) throw new Error('Webhook Z-API: payload sem phone.');

    return {
      telefone: `+${body.phone}`,
      texto: body.text?.message ?? '',
      recebidoEm: body.momment ? new Date(body.momment) : new Date(),
    };
  }
}
