// Barramento de eventos em memória pra empurrar atualização em tempo real
// pro navegador (Server-Sent Events, ver rota /api/eventos/stream em
// server.ts). Fica só neste processo — não é fila persistente nem
// multi-instância (o servidor roda como processo único, ver seção 5 do
// CLAUDE.md), então um evento perdido (servidor reiniciando, aba
// desconectada) não é catástrofe: o cliente sempre tem um poll de segurança
// mais espaçado por trás, que pega o estado real do banco de qualquer jeito.
// Ou seja: SSE aqui é só "avisa mais rápido", nunca a única fonte de verdade.

import { EventEmitter } from 'node:events';

/**
 * Categoria do que mudou — o cliente usa isso só pra decidir QUAL fetch
 * repetir na hora (não carrega o dado em si, então não tem risco de o
 * evento carregar informação que o destinatário não deveria ver; quem
 * decide o que cada sessão pode ver continua sendo a rota GET de sempre,
 * I1). `parceiroId` filtra o evento pra quem é dono do dado; ausente =
 * evento relevante pra qualquer sessão autenticada (ex.: lote mudou de
 * status, vale pra todo mundo).
 */
export interface EventoTempoReal {
  categoria: 'lotes' | 'registros' | 'submissoes' | 'documentos' | 'notificacoes' | 'contestacoes';
  parceiroId?: string | null;
  /** Texto curto opcional pro sino de notificações — só quando o evento é
   * relevante o bastante pra virar notificação visível, não todo evento vira uma. */
  notificacao?: { titulo: string; mensagem: string };
}

const bus = new EventEmitter();
// Cada aba com o portal aberto mantém uma conexão SSE — em uso normal isso
// fica bem abaixo do default de 10, mas o valor default gera um warning de
// memory leak no Node que só atrapalha o log; sobe o teto sem exagero.
bus.setMaxListeners(500);

export function emitirEvento(evento: EventoTempoReal): void {
  bus.emit('evento', evento);
}

/** Retorna uma função de cancelamento — sempre chamar no `close` da conexão. */
export function onEvento(handler: (evento: EventoTempoReal) => void): () => void {
  bus.on('evento', handler);
  return () => bus.off('evento', handler);
}
