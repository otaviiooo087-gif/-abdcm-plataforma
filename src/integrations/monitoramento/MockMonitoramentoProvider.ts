import type {
  MonitoramentoProvider,
  CriarMonitoramentoInput,
  MonitoramentoCriado,
  MovimentacaoEncontrada,
  AtualizacaoMonitoramento,
} from './MonitoramentoProvider.js';

// Provedor de desenvolvimento: não fala com nenhum tribunal de verdade —
// gera um id de acompanhamento local e nunca produz movimentação sozinho.
// O fluxo inteiro (lote ganha numero_processo → monitoramento "criado" →
// tela de Processos mostra "monitorado, sem movimentação ainda") funciona
// sem conta no provedor real, exatamente como os outros mocks.
export class MockMonitoramentoProvider implements MonitoramentoProvider {
  async criarMonitoramento(_input: CriarMonitoramentoInput): Promise<MonitoramentoCriado> {
    void _input;
    return { trackingId: `mock_track_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
  }

  async consultarMovimentacoes(_trackingId: string): Promise<MovimentacaoEncontrada[]> {
    return [];
  }

  async validarWebhook(): Promise<AtualizacaoMonitoramento> {
    throw new Error('MockMonitoramentoProvider não recebe webhook — não há provedor real configurado.');
  }
}
