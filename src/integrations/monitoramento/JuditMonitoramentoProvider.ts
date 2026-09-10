import type {
  MonitoramentoProvider,
  CriarMonitoramentoInput,
  MonitoramentoCriado,
  MovimentacaoEncontrada,
  AtualizacaoMonitoramento,
} from './MonitoramentoProvider.js';

// Integração real com a API da JUDIT (https://judit.io — monitoramento
// processual, docs.judit.io).
//
// IMPORTANTE: implementado a partir da documentação pública (busca na web —
// este ambiente de desenvolvimento não tem acesso de rede a docs.judit.io
// nem judit.io pra ler a referência completa), sem conta real pra testar.
// Antes de usar em produção: (1) confirme com a documentação oficial (ou
// suporte da JUDIT) os hosts exatos, o nome do header de autenticação e o
// formato completo do payload de webhook — os pontos abaixo estão marcados
// como PRESUMIDO onde a fonte pública não deixou 100% claro; (2) valide um
// fluxo completo (criar monitoramento → aguardar movimentação real ou
// simulada → conferir o webhook) com uma chave de teste antes de apontar
// pra um tenant de verdade.
//
// Auth: header "api-key" com a chave (JUDIT_API_KEY).
// Hosts: "requests.prod.judit.io" pra consulta avulsa, "tracking.prod.judit.io"
// pra monitoramento recorrente — PRESUMIDO a partir de exemplos públicos;
// a JUDIT pode ter renomeado pra "production" em vez de "prod".

const REQUESTS_BASE_URL = 'https://requests.prod.judit.io';
const TRACKING_BASE_URL = 'https://tracking.prod.judit.io';

async function juditFetch<T>(baseUrl: string, path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = process.env.JUDIT_API_KEY;
  if (!apiKey) throw new Error('JUDIT_API_KEY ausente — configure a variável de ambiente.');

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
      ...init.headers,
    },
  });

  if (!res.ok) {
    const corpo = await res.text().catch(() => '');
    throw new Error(`JUDIT ${path} falhou (${res.status}): ${corpo.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

interface JuditTrackingCriado {
  tracking_id?: string;
  id?: string;
}

// PRESUMIDO: formato da movimentação retornada em GET /tracking/{id} e no
// payload do webhook — a JUDIT devolve a "árvore" completa do processo
// (lawsuit) com uma lista de andamentos; os nomes de campo abaixo (step,
// content/description, date/step_date) são os mais citados publicamente,
// mas confira contra uma resposta real antes de confiar cegamente.
interface JuditMovimentacao {
  content?: string;
  description?: string;
  step_date?: string;
  date?: string;
  source?: string;
}

interface JuditLawsuitResponse {
  lawsuit?: {
    steps?: JuditMovimentacao[];
  };
  steps?: JuditMovimentacao[];
}

function mapMovimentacoes(bruto: JuditMovimentacao[] | undefined): MovimentacaoEncontrada[] {
  if (!Array.isArray(bruto)) return [];
  const resultado: MovimentacaoEncontrada[] = [];
  for (const m of bruto) {
    const descricao = (m.content ?? m.description ?? '').trim();
    if (!descricao) continue;
    const dataStr = m.step_date ?? m.date ?? null;
    resultado.push({
      descricao,
      ocorridoEm: dataStr ? new Date(dataStr) : null,
      fonte: m.source ?? null,
    });
  }
  return resultado;
}

export class JuditMonitoramentoProvider implements MonitoramentoProvider {
  async criarMonitoramento(input: CriarMonitoramentoInput): Promise<MonitoramentoCriado> {
    const criado = await juditFetch<JuditTrackingCriado>(TRACKING_BASE_URL, '/tracking', {
      method: 'POST',
      body: JSON.stringify({
        recurrence: 1, // PRESUMIDO: unidade em dias — confirme na doc antes de produção
        search: { search_type: 'lawsuit_cnj', search_key: input.numeroProcesso },
        callback_url: input.callbackUrl,
      }),
    });

    const trackingId = criado.tracking_id ?? criado.id;
    if (!trackingId) throw new Error('JUDIT: resposta de criação de monitoramento sem tracking_id.');
    return { trackingId };
  }

  async consultarMovimentacoes(trackingId: string): Promise<MovimentacaoEncontrada[]> {
    const resposta = await juditFetch<JuditLawsuitResponse>(REQUESTS_BASE_URL, `/tracking/${trackingId}`);
    return mapMovimentacoes(resposta.lawsuit?.steps ?? resposta.steps);
  }

  async validarWebhook(
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<AtualizacaoMonitoramento> {
    // PRESUMIDO: a JUDIT não documenta publicamente um segredo de webhook
    // próprio — se JUDIT_WEBHOOK_TOKEN estiver configurado, exige ele como
    // query string/header (ajustar conforme a doc real assim que
    // disponível); sem isso configurado, aceita qualquer payload — mesma
    // postura condicional do AsaasPixProvider.
    const tokenEsperado = process.env.JUDIT_WEBHOOK_TOKEN;
    if (tokenEsperado) {
      const tokenRecebido = headers['x-judit-webhook-token'];
      if (tokenRecebido !== tokenEsperado) {
        throw new Error('Webhook JUDIT: token de autenticação inválido.');
      }
    }

    const body = payload as {
      reference_id?: string;
      payload?: { request_id?: string; response_id?: string };
      response?: JuditLawsuitResponse;
    };

    const trackingId = body.reference_id ?? body.payload?.request_id;
    if (!trackingId) throw new Error('Webhook JUDIT: payload sem reference_id/request_id.');

    // O webhook público documentado só confirma QUE algo mudou (event_type,
    // ids) — o conteúdo da movimentação em si costuma vir só na resposta
    // completa. Se já vier embutido em `response`, usa direto; senão busca.
    const movimentacoes = body.response
      ? mapMovimentacoes(body.response.lawsuit?.steps ?? body.response.steps)
      : await this.consultarMovimentacoes(trackingId);

    return { trackingId, movimentacoes };
  }
}
