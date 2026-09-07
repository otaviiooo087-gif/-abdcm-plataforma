// Interface do provedor de WhatsApp (CLAUDE.md seção 8), adaptada pra
// Z-API: diferente da Meta Cloud API oficial, a Z-API não distingue
// mensagem-modelo de texto-livre nem impõe janela de 24h — todo envio é
// texto livre. Se um dia o provedor oficial (Meta) entrar, essa interface
// ganha um segundo método (enviarTemplate) sem quebrar quem já usa este.

export interface EnviarTextoInput {
  telefone: string; // E.164, ex: +5511987654321
  texto: string;
}

export interface EnvioResultado {
  id: string; // id da mensagem no provedor
}

export interface MensagemRecebida {
  telefone: string;
  texto: string;
  recebidoEm: Date;
}

export interface WhatsAppProvider {
  enviarTexto(input: EnviarTextoInput): Promise<EnvioResultado>;
  validarWebhook(payload: unknown, headers: Record<string, string | string[] | undefined>): Promise<MensagemRecebida>;
}
