import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { StorageProvider, CriarUrlUploadInput, UrlUpload } from './StorageProvider.js';

// Provedor de desenvolvimento: em vez de um bucket real, aponta pras rotas
// mock de src/server/storageMock.ts (servidas em /api/storage/mock/:key),
// que leem/escrevem num diretório local. Só pra testar o fluxo com poucos
// arquivos — não é o caminho usado em produção (10 mil documentos vão pro
// R2 direto do navegador, nunca por aqui).

export const MOCK_STORAGE_DIR = path.join(process.cwd(), '.data', 'mock-storage');

export function caminhoLocalSeguro(key: string): string {
  const normalizado = path.normalize(key).replace(/^([./\\])+/, '');
  const resolvido = path.join(MOCK_STORAGE_DIR, normalizado);
  if (!resolvido.startsWith(MOCK_STORAGE_DIR)) {
    throw new Error('Chave de armazenamento inválida.');
  }
  return resolvido;
}

export class MockStorageProvider implements StorageProvider {
  async criarUrlUpload(input: CriarUrlUploadInput): Promise<UrlUpload> {
    // A key é sempre gerada pelo servidor (ids próprios, sem caractere
    // especial) — dá pra usar direto na URL, preservando as barras da
    // "pasta" pra rota mock (wildcard) resolver o caminho local certo.
    return { uploadUrl: `/api/storage/mock/${input.key}` };
  }

  async criarUrlDownload(key: string): Promise<string> {
    return `/api/storage/mock/${key}`;
  }

  async excluir(key: string): Promise<void> {
    try {
      await fs.unlink(caminhoLocalSeguro(key));
    } catch {
      // já não existia — ok
    }
  }
}
