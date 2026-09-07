import type { PixProvider, CriarCobrancaInput, CobrancaCriada, StatusCobranca, EventoPagamento } from './PixProvider.js';

// Provedor de desenvolvimento: gera um payload BR Code plausível (visual,
// não é aceito por nenhum banco de verdade) e nunca confirma pagamento
// sozinho — quem confirma é o botão "Simular Pagamento" do modal, que
// chama POST /api/submissoes/:id/pagar diretamente.
export class MockPixProvider implements PixProvider {
  async criarCobranca(input: CriarCobrancaInput): Promise<CobrancaCriada> {
    const txid = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const valorFormatado = (input.valor / 100).toFixed(2);
    const copiaECola =
      `00020101021226800014br.gov.bcb.pix2558pix.abdcm.org.br/qr/v2/${txid}` +
      `5204000053039865406${valorFormatado.replace('.', '')}5802BR5925ABDCM COLETIVA LTDA6009SAO PAULO62070503***6304MOCK`;

    return {
      txid,
      qrCodeBase64: '',
      copiaECola,
      expiraEm: new Date(Date.now() + input.expiraEmSegundos * 1000),
    };
  }

  async consultarCobranca(_txid: string): Promise<StatusCobranca> {
    return 'pendente';
  }

  async validarWebhook(): Promise<EventoPagamento> {
    throw new Error('MockPixProvider não recebe webhook — use o botão de simular pagamento.');
  }
}
