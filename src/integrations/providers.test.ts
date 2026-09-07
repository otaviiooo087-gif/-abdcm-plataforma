import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockPixProvider } from './pix/MockPixProvider.js';
import { pixProviderConfigurado } from './pix/index.js';
import { MockWhatsAppProvider } from './whatsapp/MockWhatsAppProvider.js';
import { whatsAppProviderConfigurado } from './whatsapp/index.js';

describe('MockPixProvider', () => {
  it('gera uma cobrança com txid, copia-e-cola e expiração coerentes com o input', async () => {
    const provider = new MockPixProvider();
    const antes = Date.now();
    const cobranca = await provider.criarCobranca({
      valor: 5500,
      referenciaExterna: 'sub-teste',
      pagador: { nome: 'Fulano', cpfCnpj: '12345678900' },
      expiraEmSegundos: 3600,
      descricao: 'teste',
    });

    expect(cobranca.txid).toMatch(/^mock_/);
    expect(cobranca.copiaECola).toContain(cobranca.txid);
    expect(cobranca.expiraEm.getTime()).toBeGreaterThanOrEqual(antes + 3600 * 1000);
  });

  it('duas cobranças nunca saem com o mesmo txid (evita colisão no índice único)', async () => {
    const provider = new MockPixProvider();
    const a = await provider.criarCobranca({
      valor: 100,
      referenciaExterna: 'x',
      pagador: { nome: 'A', cpfCnpj: '1' },
      expiraEmSegundos: 60,
      descricao: '',
    });
    const b = await provider.criarCobranca({
      valor: 100,
      referenciaExterna: 'x',
      pagador: { nome: 'A', cpfCnpj: '1' },
      expiraEmSegundos: 60,
      descricao: '',
    });
    expect(a.txid).not.toBe(b.txid);
  });

  it('consultarCobranca sempre reporta pendente (confirmação só vem do botão de simular)', async () => {
    const provider = new MockPixProvider();
    await expect(provider.consultarCobranca('qualquer')).resolves.toBe('pendente');
  });
});

describe('MockWhatsAppProvider', () => {
  it('sempre "envia" com sucesso e retorna um id', async () => {
    const provider = new MockWhatsAppProvider();
    const resultado = await provider.enviarTexto({ telefone: '+5511999999999', texto: 'oi' });
    expect(resultado.id).toMatch(/^mock_wa_/);
  });
});

describe('seleção de provedor por variável de ambiente', () => {
  const originais = {
    PIX_PROVIDER: process.env.PIX_PROVIDER,
    ASAAS_API_KEY: process.env.ASAAS_API_KEY,
    WHATSAPP_PROVIDER: process.env.WHATSAPP_PROVIDER,
    ZAPI_INSTANCE_ID: process.env.ZAPI_INSTANCE_ID,
    ZAPI_TOKEN: process.env.ZAPI_TOKEN,
  };

  afterEach(() => {
    for (const [chave, valor] of Object.entries(originais)) {
      if (valor === undefined) delete process.env[chave];
      else process.env[chave] = valor;
    }
  });

  beforeEach(() => {
    delete process.env.PIX_PROVIDER;
    delete process.env.ASAAS_API_KEY;
    delete process.env.WHATSAPP_PROVIDER;
    delete process.env.ZAPI_INSTANCE_ID;
    delete process.env.ZAPI_TOKEN;
  });

  it('PIX cai pro mock quando PIX_PROVIDER não é "real" ou falta a API key', () => {
    expect(pixProviderConfigurado()).toBe(false);
    process.env.PIX_PROVIDER = 'real';
    expect(pixProviderConfigurado()).toBe(false); // falta ASAAS_API_KEY
    process.env.ASAAS_API_KEY = 'chave-fake';
    expect(pixProviderConfigurado()).toBe(true);
  });

  it('WhatsApp cai pro mock quando WHATSAPP_PROVIDER não é "real" ou faltam credenciais da Z-API', () => {
    expect(whatsAppProviderConfigurado()).toBe(false);
    process.env.WHATSAPP_PROVIDER = 'real';
    process.env.ZAPI_INSTANCE_ID = 'inst';
    expect(whatsAppProviderConfigurado()).toBe(false); // falta ZAPI_TOKEN
    process.env.ZAPI_TOKEN = 'token';
    expect(whatsAppProviderConfigurado()).toBe(true);
  });
});
