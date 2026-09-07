import type { WhatsAppProvider, EnviarTextoInput, EnvioResultado, MensagemRecebida } from './WhatsAppProvider.js';

// Provedor de desenvolvimento: não manda nada de verdade, só registra no
// log do servidor — permite testar todo o motor de automação (dedupe,
// agendamento, templates) sem número de WhatsApp nenhum configurado.
export class MockWhatsAppProvider implements WhatsAppProvider {
  async enviarTexto(input: EnviarTextoInput): Promise<EnvioResultado> {
    const id = `mock_wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[WhatsApp MOCK] para ${input.telefone}: ${input.texto}`);
    return { id };
  }

  async validarWebhook(): Promise<MensagemRecebida> {
    throw new Error('MockWhatsAppProvider não recebe webhook.');
  }
}
