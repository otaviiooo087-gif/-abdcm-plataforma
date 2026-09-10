// Interface do provedor de monitoramento processual (acompanhamento
// automático do processo judicial de um lote junto ao tribunal). Nenhum SDK
// de terceiro deve vazar pra fora de src/integrations/monitoramento — o
// resto do sistema só conhece este contrato (mesma doutrina de PIX/WhatsApp/
// OCR, CLAUDE.md seção 8).
//
// Fluxo: quando um lote ganha número de processo (numero_processo), o
// sistema chama criarMonitoramento() uma vez — o provedor passa a avisar
// (webhook) sempre que o processo tiver movimentação nova. consultarMovimentacoes
// existe como reforço: uma reconciliação periódica chama isso pros
// monitoramentos ativos, cobrindo webhook perdido/atrasado (mesma lógica já
// usada pra PIX em store.ts:reconciliarPixPendentes).
//
// O que "monitorar" NÃO faz: não interpreta o teor da movimentação (não
// tenta adivinhar se uma liminar foi deferida ou não a partir do texto) —
// isso fica só como registro pra leitura humana. Decisão de negócio a
// partir do conteúdo continua manual (liminar_status do lote é editado
// pelo admin, não inferido daqui).

export interface CriarMonitoramentoInput {
  /** Número do processo no formato CNJ (ex.: 0001234-56.2026.4.03.6100). */
  numeroProcesso: string;
  /** URL do nosso webhook — o provedor bate aqui quando o processo se mexe. */
  callbackUrl: string;
}

export interface MonitoramentoCriado {
  /** Id do monitoramento no provedor — guardado em lotes.judit_tracking_id
   * pra poder consultar/cancelar depois. */
  trackingId: string;
}

export interface MovimentacaoEncontrada {
  descricao: string;
  /** null quando o provedor não informa data da movimentação específica. */
  ocorridoEm: Date | null;
  /** Nome do tribunal/fonte de onde veio, quando o provedor informa. */
  fonte?: string | null;
}

export interface AtualizacaoMonitoramento {
  trackingId: string;
  movimentacoes: MovimentacaoEncontrada[];
}

export interface MonitoramentoProvider {
  criarMonitoramento(input: CriarMonitoramentoInput): Promise<MonitoramentoCriado>;
  /** Poll de reforço — não é o caminho principal (isso é o webhook), mas
   * cobre notificação perdida/atrasada. */
  consultarMovimentacoes(trackingId: string): Promise<MovimentacaoEncontrada[]>;
  validarWebhook(
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<AtualizacaoMonitoramento>;
}
