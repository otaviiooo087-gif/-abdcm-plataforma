/**
 * Criptografia simétrica (AES-256-GCM) das credenciais de integração
 * guardadas no banco. A chave mestra continua exclusivamente em variável de
 * ambiente (I10 revisado — ver CLAUDE.md seção 2): sem ela, nada aqui
 * funciona, nem em modo mock, porque só é chamado quando alguém de fato
 * tenta salvar/ler uma credencial real.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function chaveMestra(): Buffer {
  const b64 = process.env.CREDENCIAIS_ENCRYPTION_KEY;
  if (!b64) {
    throw new Error(
      'CREDENCIAIS_ENCRYPTION_KEY não configurada no servidor — necessária para salvar ou revelar chaves de API.',
    );
  }
  const chave = Buffer.from(b64, 'base64');
  if (chave.length !== 32) {
    throw new Error('CREDENCIAIS_ENCRYPTION_KEY precisa decodificar (base64) para exatamente 32 bytes (AES-256).');
  }
  return chave;
}

/** Retorna "iv.authTag.textoCifrado", tudo em base64, separado por ponto. */
export function criptografarValores(valores: Record<string, string>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', chaveMestra(), iv);
  const textoCifrado = Buffer.concat([cipher.update(JSON.stringify(valores), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), textoCifrado.toString('base64')].join('.');
}

export function descriptografarValores(dados: string): Record<string, string> {
  const partes = dados.split('.');
  if (partes.length !== 3) throw new Error('Dados criptografados em formato inválido.');
  const [ivB64, authTagB64, textoCifradoB64] = partes;
  const decipher = createDecipheriv('aes-256-gcm', chaveMestra(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const textoPlano = Buffer.concat([decipher.update(Buffer.from(textoCifradoB64, 'base64')), decipher.final()]);
  return JSON.parse(textoPlano.toString('utf8'));
}
