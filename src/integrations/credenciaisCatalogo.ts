/**
 * Catálogo central de integrações que aceitam chave de API configurável.
 * Fonte única de verdade pros campos esperados por provedor — usado tanto
 * pela tela de admin (via /api/admin/credenciais) quanto pela validação no
 * servidor ao salvar uma credencial. Nenhum valor real aqui, só metadados.
 */

export type IntegracaoProviderId =
  | 'pix_asaas'
  | 'whatsapp_zapi'
  | 'storage_r2'
  | 'ocr_claude'
  | 'monitoramento_judit'
  | 'bureau_serasa';

export interface CampoCredencial {
  chave: string;
  rotulo: string;
  obrigatorio: boolean;
}

export interface IntegracaoDefinicao {
  provider: IntegracaoProviderId;
  nome: string;
  categoria: string;
  campos: CampoCredencial[];
  unidadeCustoPadrao: string;
  /** Nome das env vars equivalentes, só pra exibir na tela como alternativa. */
  envVarsEquivalentes: string[];
}

export const CATALOGO_INTEGRACOES: IntegracaoDefinicao[] = [
  {
    provider: 'pix_asaas',
    nome: 'PIX (Asaas)',
    categoria: 'Pagamento',
    campos: [{ chave: 'ASAAS_API_KEY', rotulo: 'Chave de API', obrigatorio: true }],
    unidadeCustoPadrao: 'por cobrança gerada',
    envVarsEquivalentes: ['PIX_PROVIDER=real', 'ASAAS_API_KEY'],
  },
  {
    provider: 'whatsapp_zapi',
    nome: 'WhatsApp (Z-API)',
    categoria: 'Comunicação',
    campos: [
      { chave: 'ZAPI_INSTANCE_ID', rotulo: 'Instance ID', obrigatorio: true },
      { chave: 'ZAPI_TOKEN', rotulo: 'Token', obrigatorio: true },
    ],
    unidadeCustoPadrao: 'por mensagem enviada',
    envVarsEquivalentes: ['WHATSAPP_PROVIDER=real', 'ZAPI_INSTANCE_ID', 'ZAPI_TOKEN'],
  },
  {
    provider: 'storage_r2',
    nome: 'Armazenamento (Cloudflare R2)',
    categoria: 'Infraestrutura',
    campos: [
      { chave: 'R2_ACCOUNT_ID', rotulo: 'Account ID', obrigatorio: true },
      { chave: 'R2_ACCESS_KEY_ID', rotulo: 'Access Key ID', obrigatorio: true },
      { chave: 'R2_SECRET_ACCESS_KEY', rotulo: 'Secret Access Key', obrigatorio: true },
      { chave: 'R2_BUCKET_NAME', rotulo: 'Nome do bucket', obrigatorio: true },
    ],
    unidadeCustoPadrao: 'por GB armazenado/mês',
    envVarsEquivalentes: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'],
  },
  {
    provider: 'ocr_claude',
    nome: 'Leitura de documento (Claude)',
    categoria: 'Automação',
    campos: [{ chave: 'ANTHROPIC_API_KEY', rotulo: 'Chave de API', obrigatorio: true }],
    unidadeCustoPadrao: 'por documento lido',
    envVarsEquivalentes: ['OCR_PROVIDER=real', 'ANTHROPIC_API_KEY'],
  },
  {
    provider: 'monitoramento_judit',
    nome: 'Monitoramento processual (Judit.io)',
    categoria: 'Automação',
    campos: [
      { chave: 'JUDIT_API_KEY', rotulo: 'Chave de API', obrigatorio: true },
      { chave: 'JUDIT_WEBHOOK_TOKEN', rotulo: 'Token de webhook', obrigatorio: false },
    ],
    unidadeCustoPadrao: 'por consulta',
    envVarsEquivalentes: ['MONITORAMENTO_PROVIDER=real', 'JUDIT_API_KEY', 'JUDIT_WEBHOOK_TOKEN'],
  },
  {
    provider: 'bureau_serasa',
    nome: 'Consulta de baixa (Serasa)',
    categoria: 'Automação',
    campos: [
      { chave: 'SERASA_CLIENT_ID', rotulo: 'Client ID', obrigatorio: true },
      { chave: 'SERASA_CLIENT_SECRET', rotulo: 'Client Secret', obrigatorio: true },
    ],
    unidadeCustoPadrao: 'por consulta',
    envVarsEquivalentes: ['BUREAU_PROVIDER=real', 'SERASA_CLIENT_ID', 'SERASA_CLIENT_SECRET'],
  },
];

export function definicaoIntegracao(provider: string): IntegracaoDefinicao | undefined {
  return CATALOGO_INTEGRACOES.find((d) => d.provider === provider);
}
