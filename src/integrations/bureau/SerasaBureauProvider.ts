import type { BureauProvider, ConsultarStatusBureauInput, StatusBureau } from './BureauProvider.js';
import { valorCredencial } from '../credencialResolver.js';

// Integração real com a API de consulta da Serasa Experian.
//
// IMPORTANTE — mais incerto que os outros providers reais deste projeto
// (Asaas/Z-API/JUDIT): a Serasa Experian não publica documentação pública
// completa da API de consulta — é um produto B2B que exige gerente de
// conta e homologação antes de liberar client_id/client_secret e o
// endpoint exato de consulta (confirmado via busca na web, não há acesso
// de rede a developer.experian.com neste ambiente). O que está implementado
// abaixo é o padrão de autenticação OAuth2 client_credentials (Basic
// base64(client_id:client_secret) → token Bearer) que a documentação
// pública indica ser usado — está marcado como PRESUMIDO onde a fonte não
// deixou claro. ANTES de usar em produção: peça ao gerente de conta
// Serasa/escritório jurídico parceiro (1) a URL base real de autenticação e
// consulta, (2) o formato exato do payload de consulta e resposta, (3) o
// nome do produto/relatório que traz "restrição ativa" de forma direta —
// alguns produtos Serasa retornam score/histórico, não um booleano simples.
//
// Auth: client_credentials, client_id/client_secret via BUREAU_PROVIDER real.

const AUTH_URL = 'https://api.serasaexperian.com.br/oauth/token'; // PRESUMIDO
const CONSULTA_URL = 'https://api.serasaexperian.com.br/consulta/situacao-cadastral'; // PRESUMIDO

let tokenCache: { valor: string; expiraEm: number } | null = null;

async function obterToken(): Promise<string> {
  if (tokenCache && tokenCache.expiraEm > Date.now()) return tokenCache.valor;

  const clientId = valorCredencial('bureau_serasa', 'SERASA_CLIENT_ID');
  const clientSecret = valorCredencial('bureau_serasa', 'SERASA_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('SERASA_CLIENT_ID/SERASA_CLIENT_SECRET ausentes — configure em Configurações > Chaves de API.');
  }

  const credenciais = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credenciais}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials', // PRESUMIDO
  });
  if (!res.ok) throw new Error(`Serasa (auth): ${res.status} ${await res.text()}`);

  const body = (await res.json()) as { access_token: string; expires_in: number }; // PRESUMIDO
  tokenCache = { valor: body.access_token, expiraEm: Date.now() + (body.expires_in - 30) * 1000 };
  return tokenCache.valor;
}

export class SerasaBureauProvider implements BureauProvider {
  async consultarStatus(input: ConsultarStatusBureauInput): Promise<StatusBureau> {
    const token = await obterToken();
    const res = await fetch(CONSULTA_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documento: input.cpfCnpj }), // PRESUMIDO
    });
    if (!res.ok) throw new Error(`Serasa (consulta): ${res.status} ${await res.text()}`);

    const body = (await res.json()) as { restricaoAtiva?: boolean; detalhes?: string }; // PRESUMIDO
    return { restricaoAtiva: body.restricaoAtiva ?? true, detalhes: body.detalhes ?? null };
  }
}
