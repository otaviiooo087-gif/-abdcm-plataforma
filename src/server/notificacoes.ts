/**
 * Motor de automação de avisos por WhatsApp. Cada regra (proximo_lote,
 * follow_up_lista, status_processo, pagamento_pendente) é independente,
 * idempotente (nunca manda o mesmo aviso duas vezes pra o mesmo
 * destinatário — ver notificacoes_enviadas) e liga/desliga pela aba
 * Automações (automacoes_config). Uma regra falhando nunca derruba as
 * outras — ver rodarAutomacoes().
 */

import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { db } from './db/client.js';
import * as schema from './db/schema.js';
import { ABDCM_TENANT_ID } from './mockData.js';
import { getWhatsAppProvider } from '../integrations/whatsapp/index.js';
import { AUTOMACOES_DISPONIVEIS, getAutomacoesConfig, getMensagensExtra, aplicarTemplateMensagem } from './store.js';
import type { TipoNotificacao, Registro } from '../domain/types.js';

function novoId(prefixo: string): string {
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { weekday: 'long' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

async function jaFoiEnviado(
  tipo: string,
  referenciaTipo: string,
  referenciaId: string,
  telefone: string,
): Promise<boolean> {
  const linhas = await db()
    .select({ id: schema.notificacoesEnviadas.id })
    .from(schema.notificacoesEnviadas)
    .where(
      and(
        eq(schema.notificacoesEnviadas.tipo, tipo),
        eq(schema.notificacoesEnviadas.referenciaTipo, referenciaTipo),
        eq(schema.notificacoesEnviadas.referenciaId, referenciaId),
        eq(schema.notificacoesEnviadas.destinatarioTelefone, telefone),
      ),
    )
    .limit(1);
  return linhas.length > 0;
}

/** Envia (via provedor configurado) e registra — pulando quem já recebeu este exato aviso. */
async function enviarComDedup(params: {
  tipo: string;
  telefone: string;
  mensagem: string;
  associadoId?: string;
  referenciaTipo: string;
  referenciaId: string;
}): Promise<boolean> {
  if (await jaFoiEnviado(params.tipo, params.referenciaTipo, params.referenciaId, params.telefone)) {
    return false;
  }

  try {
    const resultado = await getWhatsAppProvider().enviarTexto({ telefone: params.telefone, texto: params.mensagem });
    await db().insert(schema.notificacoesEnviadas).values({
      id: novoId('notif'),
      tenantId: ABDCM_TENANT_ID,
      tipo: params.tipo,
      destinatarioTelefone: params.telefone,
      associadoId: params.associadoId ?? null,
      referenciaTipo: params.referenciaTipo,
      referenciaId: params.referenciaId,
      mensagem: params.mensagem,
      providerMessageId: resultado.id,
      status: 'enviado',
      enviadoEm: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    // Não registra em notificacoes_enviadas: falha não conta como "já
    // avisado", então a próxima rodada do agendador tenta de novo.
    console.error(`[automacoes] falha ao enviar WhatsApp (${params.tipo}) para ${params.telefone}:`, err);
    return false;
  }
}

async function regraAtiva(chave: TipoNotificacao): Promise<{ ativo: boolean; config: Record<string, unknown> }> {
  const todas = await getAutomacoesConfig();
  const linha = todas.find((r) => r.chave === chave);
  return { ativo: linha?.ativo ?? true, config: linha?.config ?? AUTOMACOES_DISPONIVEIS[chave].configPadrao };
}

/** Associados que devem receber aviso — qualquer um que não foi explicitamente desativado. */
function associadosElegiveis() {
  return db()
    .select()
    .from(schema.associados)
    .where(and(eq(schema.associados.tenantId, ABDCM_TENANT_ID), isNotNull(schema.associados.telefoneWhatsapp)));
}

/**
 * Envia as mensagens extras cadastradas pelo admin (aba Automações > "Criar
 * Nova Mensagem") pro mesmo gatilho — cada extra é deduplicada pelo próprio
 * id (um associado nunca recebe a mesma extra duas vezes pra mesma referência).
 */
async function enviarExtrasDoGatilho(
  gatilho: TipoNotificacao,
  telefone: string,
  associadoId: string | undefined,
  referenciaTipo: string,
  referenciaId: string,
  tokens: Record<string, string>,
): Promise<number> {
  const extras = (await getMensagensExtra()).filter((m) => m.gatilho === gatilho && m.ativo);
  let enviados = 0;
  for (const extra of extras) {
    const enviou = await enviarComDedup({
      tipo: `extra:${extra.id}`,
      telefone,
      mensagem: aplicarTemplateMensagem(extra.mensagem, tokens),
      associadoId,
      referenciaTipo,
      referenciaId,
    });
    if (enviou) enviados++;
  }
  return enviados;
}

// -----------------------------------------------------------------------
// 1. Próxima Ação Coletiva abrindo
// -----------------------------------------------------------------------
async function avisarProximoLote(): Promise<number> {
  const { ativo, config } = await regraAtiva('proximo_lote');
  if (!ativo) return 0;

  const lotesAbertos = await db().select().from(schema.lotes).where(eq(schema.lotes.status, 'aberto'));
  const associados = await associadosElegiveis();
  let enviados = 0;

  for (const lote of lotesAbertos) {
    const tokens = { saudacao: saudacao(), lote: lote.nome, data: formatarDataHora(lote.closesAt) };
    const template =
      typeof config.mensagemTemplate === 'string' && config.mensagemTemplate.trim()
        ? config.mensagemTemplate
        : `{saudacao}! Aqui é da ABDCM 👋 Passando pra avisar que a próxima Lista Limpa Nome ` +
          `({lote}) está com captação aberta, encerrando em {data}. ` +
          `Aproveita pra anexar seus nomes com o parceiro que cuidou da sua filiação!`;
    const mensagem = aplicarTemplateMensagem(template, tokens);

    for (const associado of associados) {
      if (associado.statusFiliacao === 'inativo') continue;
      const enviou = await enviarComDedup({
        tipo: 'proximo_lote',
        telefone: associado.telefoneWhatsapp,
        mensagem,
        associadoId: associado.id,
        referenciaTipo: 'lote',
        referenciaId: lote.id,
      });
      if (enviou) enviados++;
      enviados += await enviarExtrasDoGatilho('proximo_lote', associado.telefoneWhatsapp, associado.id, 'lote', lote.id, {
        ...tokens,
        nome: associado.nome.split(' ')[0],
      });
    }
  }
  return enviados;
}

// -----------------------------------------------------------------------
// 2. Follow-up antes do encerramento (quem ainda não entrou na lista aberta)
// -----------------------------------------------------------------------
async function avisarFollowUpLista(): Promise<number> {
  const { ativo, config } = await regraAtiva('follow_up_lista');
  if (!ativo) return 0;
  const horasAntes = Number(config.horasAntesDoFechamento ?? 24);

  const lotesAbertos = await db().select().from(schema.lotes).where(eq(schema.lotes.status, 'aberto'));
  const limiteAviso = new Date(Date.now() + horasAntes * 3_600_000);
  let enviados = 0;

  for (const lote of lotesAbertos) {
    if (new Date(lote.closesAt) > limiteAviso) continue; // ainda não entrou na janela de aviso

    const registrosDoLote = await db()
      .select({ associadoId: schema.registros.associadoId })
      .from(schema.registros)
      .where(eq(schema.registros.loteId, lote.id));
    const jaEntraram = new Set(registrosDoLote.map((r) => r.associadoId));

    const associados = await associadosElegiveis();
    for (const associado of associados) {
      if (associado.statusFiliacao === 'inativo' || jaEntraram.has(associado.id)) continue;

      const tokens = { saudacao: saudacao(), nome: associado.nome.split(' ')[0], lote: lote.nome, data: formatarDataHora(lote.closesAt) };
      const template =
        typeof config.mensagemTemplate === 'string' && config.mensagemTemplate.trim()
          ? config.mensagemTemplate
          : `Oi {nome}! Notei que você ainda não anexou os seus nomes na Lista Limpa Nome ` +
            `({lote}), que fecha {data}. Anexa agora pra não perder a oportunidade de ter seus nomes limpos!`;
      const mensagem = aplicarTemplateMensagem(template, tokens);

      const enviou = await enviarComDedup({
        tipo: 'follow_up_lista',
        telefone: associado.telefoneWhatsapp,
        mensagem,
        associadoId: associado.id,
        referenciaTipo: 'lote',
        referenciaId: lote.id,
      });
      if (enviou) enviados++;
      enviados += await enviarExtrasDoGatilho('follow_up_lista', associado.telefoneWhatsapp, associado.id, 'lote', lote.id, tokens);
    }
  }
  return enviados;
}

// -----------------------------------------------------------------------
// 3. Status do processo — chamado direto pelas rotas de transição de status
//    (não faz varredura própria, é orientado a evento).
// -----------------------------------------------------------------------
const STATUS_COM_AVISO: ReadonlySet<string> = new Set(['pago', 'protocolado', 'baixado', 'recusado']);

const MENSAGEM_POR_STATUS: Record<string, (loteNome: string, bureaus: string) => string> = {
  pago: (loteNome) => `Pagamento confirmado! Seus nomes da ${loteNome} entram na próxima etapa do processo.`,
  protocolado: (loteNome, bureaus) =>
    `Passando pra avisar que os nomes anexados na ${loteNome} — ${bureaus} — se atribuíram ao processo ` +
    `e estamos aguardando as baixas começarem.`,
  baixado: (loteNome) => `Boa notícia! Seus nomes da ${loteNome} já foram baixados nos birôs. 🎉`,
  recusado: (loteNome) =>
    `Houve uma recusa no processamento da ${loteNome} pelos birôs. Nosso time vai entrar em contato com os detalhes.`,
};

export async function avisarStatusProcesso(registro: Registro, novoStatus: string): Promise<void> {
  if (!STATUS_COM_AVISO.has(novoStatus)) return;
  if (!registro.associado_id) return;

  const [associado] = await db().select().from(schema.associados).where(eq(schema.associados.id, registro.associado_id));
  if (!associado?.telefoneWhatsapp) return;

  const { ativo, config } = await regraAtiva('status_processo');
  if (!ativo) return;

  const [lote] = await db().select().from(schema.lotes).where(eq(schema.lotes.id, registro.lote_id));
  const loteNome = lote?.nome ?? 'Ação Coletiva';
  const bureaus = lote?.bureaus?.join(', ') ?? 'Serasa, SPC, Boa Vista';
  const nome = associado.nome.split(' ')[0];
  const tokens = { saudacao: saudacao(), nome, lote: loteNome, orgaos: bureaus, status: novoStatus };

  let mensagem: string;
  if (typeof config.mensagemTemplate === 'string' && config.mensagemTemplate.trim()) {
    mensagem = aplicarTemplateMensagem(config.mensagemTemplate, tokens);
  } else {
    const construtor = MENSAGEM_POR_STATUS[novoStatus];
    if (!construtor) return;
    mensagem = `${saudacao()} ${nome}! ${construtor(loteNome, bureaus)}`;
  }

  const referenciaId = `${registro.id}:${novoStatus}`;
  await enviarComDedup({
    tipo: 'status_processo',
    telefone: associado.telefoneWhatsapp,
    mensagem,
    associadoId: associado.id,
    referenciaTipo: 'registro',
    referenciaId,
  });
  await enviarExtrasDoGatilho('status_processo', associado.telefoneWhatsapp, associado.id, 'registro', referenciaId, tokens);
}

// -----------------------------------------------------------------------
// 4. Pagamento PIX pendente há muito tempo
// -----------------------------------------------------------------------
async function avisarPagamentoPendente(): Promise<number> {
  const { ativo, config } = await regraAtiva('pagamento_pendente');
  if (!ativo) return 0;
  const horas = Number(config.horasParaAvisar ?? 12);
  const limite = new Date(Date.now() - horas * 3_600_000).toISOString();

  const pendentesAntigas = await db()
    .select()
    .from(schema.submissoes)
    .where(and(eq(schema.submissoes.paymentStatus, 'pendente'), lt(schema.submissoes.submetidoEm, limite)));

  let enviados = 0;
  for (const submissao of pendentesAntigas) {
    const registrosDaSubmissao = await db().select().from(schema.registros).where(eq(schema.registros.submissaoId, submissao.id));
    const associadoIds = [...new Set(registrosDaSubmissao.map((r) => r.associadoId))];

    for (const associadoId of associadoIds) {
      const [associado] = await db().select().from(schema.associados).where(eq(schema.associados.id, associadoId));
      if (!associado?.telefoneWhatsapp) continue;

      const tokens = { saudacao: saudacao(), nome: associado.nome.split(' ')[0] };
      const template =
        typeof config.mensagemTemplate === 'string' && config.mensagemTemplate.trim()
          ? config.mensagemTemplate
          : `Oi {nome}! Vimos que o pagamento PIX da sua lista ainda está pendente. ` +
            `Aconteceu algum problema? Se precisar de ajuda é só responder por aqui 🙂`;
      const mensagem = aplicarTemplateMensagem(template, tokens);

      const referenciaId = `${submissao.id}:${associadoId}`;
      const enviou = await enviarComDedup({
        tipo: 'pagamento_pendente',
        telefone: associado.telefoneWhatsapp,
        mensagem,
        associadoId: associado.id,
        referenciaTipo: 'submissao',
        referenciaId,
      });
      if (enviou) enviados++;
      enviados += await enviarExtrasDoGatilho('pagamento_pendente', associado.telefoneWhatsapp, associado.id, 'submissao', referenciaId, tokens);
    }
  }
  return enviados;
}

// -----------------------------------------------------------------------
// 5. Boas-vindas ao se cadastrar (associado novo com WhatsApp)
// -----------------------------------------------------------------------
async function avisarBoasVindasCadastro(): Promise<number> {
  const { ativo, config } = await regraAtiva('cadastro_associado');
  if (!ativo) return 0;

  const associados = await associadosElegiveis();
  let enviados = 0;

  for (const associado of associados) {
    const tokens = { saudacao: saudacao(), nome: associado.nome.split(' ')[0] };
    const template =
      typeof config.mensagemTemplate === 'string' && config.mensagemTemplate.trim()
        ? config.mensagemTemplate
        : `{saudacao} {nome}! Aqui é da ABDCM 👋 Seja muito bem-vindo(a) ao sistema ABDCM! Você agora faz parte ` +
          `da nossa Ação Coletiva Limpa Nome — fica de olho por aqui que a gente avisa assim que a próxima lista ` +
          `abrir pra você anexar seus nomes.`;
    const mensagem = aplicarTemplateMensagem(template, tokens);

    const enviou = await enviarComDedup({
      tipo: 'cadastro_associado',
      telefone: associado.telefoneWhatsapp,
      mensagem,
      associadoId: associado.id,
      referenciaTipo: 'associado',
      referenciaId: associado.id,
    });
    if (enviou) enviados++;
    enviados += await enviarExtrasDoGatilho('cadastro_associado', associado.telefoneWhatsapp, associado.id, 'associado', associado.id, tokens);
  }
  return enviados;
}

export interface ResultadoAutomacoes {
  proximoLote: number;
  followUpLista: number;
  pagamentoPendente: number;
  boasVindasCadastro: number;
  erros: string[];
}

/** Roda as regras de varredura (as duas orientadas a evento não entram aqui). */
export async function rodarAutomacoes(): Promise<ResultadoAutomacoes> {
  const resultado: ResultadoAutomacoes = { proximoLote: 0, followUpLista: 0, pagamentoPendente: 0, boasVindasCadastro: 0, erros: [] };

  for (const [chave, fn] of [
    ['proximoLote', avisarProximoLote],
    ['followUpLista', avisarFollowUpLista],
    ['pagamentoPendente', avisarPagamentoPendente],
    ['boasVindasCadastro', avisarBoasVindasCadastro],
  ] as const) {
    try {
      resultado[chave] = await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      resultado.erros.push(`${chave}: ${msg}`);
      console.error(`[automacoes] erro em ${chave}:`, err);
    }
  }
  return resultado;
}
