import type { StorageProvider } from './StorageProvider.js';
import { MockStorageProvider } from './MockStorageProvider.js';
import { R2StorageProvider } from './R2StorageProvider.js';
import { credencialNoBanco } from '../credencialResolver.js';

export * from './StorageProvider.js';
export { MOCK_STORAGE_DIR, caminhoLocalSeguro } from './MockStorageProvider.js';

let instancia: StorageProvider | null = null;
let instanciaEraReal = false;

const CAMPOS_R2 = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];

export function storageProviderConfigurado(): boolean {
  if (CAMPOS_R2.every((chave) => credencialNoBanco('storage_r2', chave))) return true;
  return Boolean(
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME,
  );
}

export function getStorageProvider(): StorageProvider {
  const real = storageProviderConfigurado();
  if (!instancia || real !== instanciaEraReal) {
    instancia = real ? new R2StorageProvider() : new MockStorageProvider();
    instanciaEraReal = real;
  }
  return instancia;
}
