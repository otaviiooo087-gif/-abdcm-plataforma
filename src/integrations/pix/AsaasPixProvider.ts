import type { PixProvider, CriarCobrancaInput, CobrancaCriada, StatusCobranca, EventoPagamento } from './PixProvider.js';

// Integração real com a API do Asaas (https://docs.asaas.com).
//
// IMPORTANTE: implementado a partir da documentação pública e estável do
// Asaas (endpoints /customers, /payments, /payments/{id}/pixQrCode), mas
// nunca testado contra uma conta real — este ambiente de desenvolvimento
// não tem acesso de rede pra api.asaas.com. Antes de usar em produção,
// valide um fluxo completo (criar cobrança → pagar no sandbox → conferir
// o webhook) com uma chave de sandbox do Asaas.
//
// Auth: header "access_token" com a API key (ASAAS_API_KEY).
// Ambiente: ASAAS_ENV=sandbox usa https://sandbox.asaas.com/api/v3,
// qualquer outro valor (ou ausente) usa produção https://api.asaas.com/v3.

interface AsaasCustomer {
  id: string;
}

interface AsaasPayment {
  id: string;
  status: string;
}

interface AsaasPixQrCode {
  encodedImage: string; // base64 (sem prefixo data:)
  payload: string; // copia-e-cola
  expirationDate: string;
}

function baseUrl(): string {
  return process.env.ASAAS_ENV === 'sandbox'
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/v3';
}

async function asaasFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error('ASAAS_API_KEY ausente — configure a variável de ambiente.');

  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
      ...init.headers,
    },
  });

  if (!res.ok) {
    const corpo = await res.text().catch(() => '');
    throw new Error(`Asaas ${path} falhou (${res.status}): ${corpo.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

/** Localiza (ou cria) o cliente Asaas pelo CPF/CNPJ do pagador — Asaas exige um customerId por cobrança. */
async function obterOuCriarCliente(nome: string, cpfCnpj: string): Promise<string> {
  const cpfCnpjLimpo = cpfCnpj.replace(/\D/g, '');
  const existentes = await asaasFetch<{ data: AsaasCustomer[] }>(
    `/customers?cpfCnpj=${encodeURIComponent(cpfCnpjLimpo)}`,
  );
  if (existentes.data?.[0]?.id) return existentes.data[0].id;

  const novo = await asaasFetch<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify({ name: nome, cpfCnpj: cpfCnpjLimpo }),
  });
  return novo.id;
}

export class AsaasPixProvider implements PixProvider {
  async criarCobranca(input: CriarCobrancaInput): Promise<CobrancaCriada> {
    const customerId = await obterOuCriarCliente(input.pagador.nome, input.pagador.cpfCnpj);

    const vencimento = new Date(Date.now() + input.expiraEmSegundos * 1000);
    const dataVencimento = vencimento.toISOString().slice(0, 10);

    const cobranca = await asaasFetch<AsaasPayment>('/payments', {
      method: 'POST',
      body: JSON.stringify({
        customer: customerId,
        billingType: 'PIX',
        value: input.valor / 100,
        dueDate: dataVencimento,
        description: input.descricao,
        externalReference: input.referenciaExterna,
      }),
    });

    const qr = await asaasFetch<AsaasPixQrCode>(`/payments/${cobranca.id}/pixQrCode`);

    return {
      txid: cobranca.id,
      qrCodeBase64: qr.encodedImage,
      copiaECola: qr.payload,
      expiraEm: qr.expirationDate ? new Date(qr.expirationDate) : vencimento,
    };
  }

  async consultarCobranca(txid: string): Promise<StatusCobranca> {
    const cobranca = await asaasFetch<AsaasPayment>(`/payments/${txid}`);
    return mapStatus(cobranca.status);
  }

  async validarWebhook(
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<EventoPagamento> {
    const tokenEsperado = process.env.ASAAS_WEBHOOK_SECRET;
    if (tokenEsperado) {
      const tokenRecebido = headers['asaas-access-token'];
      if (tokenRecebido !== tokenEsperado) {
        throw new Error('Webhook Asaas: token de autenticação inválido.');
      }
    }

    const body = payload as {
      id?: string;
      event?: string;
      payment?: { id: string; status: string; value?: number };
    };
    if (!body?.payment?.id) throw new Error('Webhook Asaas: payload sem payment.id.');

    return {
      eventoId: body.id ?? `${body.payment.id}:${body.event ?? 'evento'}`,
      txid: body.payment.id,
      status: mapStatus(body.payment.status),
      valorPago: body.payment.value ? Math.round(body.payment.value * 100) : undefined,
    };
  }
}

function mapStatus(asaasStatus: string): StatusCobranca {
  switch (asaasStatus) {
    case 'RECEIVED':
    case 'CONFIRMED':
    case 'RECEIVED_IN_CASH':
      return 'pago';
    case 'OVERDUE':
      return 'expirado';
    case 'REFUNDED':
    case 'DELETED':
      return 'cancelado';
    default:
      return 'pendente';
  }
}
