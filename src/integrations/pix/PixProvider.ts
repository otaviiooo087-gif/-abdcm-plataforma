// Interface do provedor de PIX (CLAUDE.md seção 8). Nenhum SDK de terceiro
// deve vazar pra fora de src/integrations/pix — o resto do sistema só
// conhece este contrato.

export interface CriarCobrancaInput {
  valor: number; // centavos, sempre inteiro
  referenciaExterna: string; // submissao.id
  pagador: { nome: string; cpfCnpj: string };
  expiraEmSegundos: number;
  descricao: string;
}

export interface CobrancaCriada {
  txid: string;
  qrCodeBase64: string; // pode vir vazio quando o front desenha o QR localmente a partir do copiaECola
  copiaECola: string;
  expiraEm: Date;
}

export type StatusCobranca = 'pendente' | 'pago' | 'expirado' | 'cancelado';

export interface EventoPagamento {
  eventoId: string; // usado para idempotência de webhook
  txid: string;
  status: StatusCobranca;
  valorPago?: number;
}

export interface PixProvider {
  criarCobranca(input: CriarCobrancaInput): Promise<CobrancaCriada>;
  consultarCobranca(txid: string): Promise<StatusCobranca>;
  /** Valida a assinatura/token do webhook e traduz o payload pro formato interno. */
  validarWebhook(payload: unknown, headers: Record<string, string | string[] | undefined>): Promise<EventoPagamento>;
}
