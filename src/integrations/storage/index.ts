import type { StorageProvider } from './StorageProvider.js';
import { MockStorageProvider } from './MockStorageProvider.js';
import { R2StorageProvider } from './R2StorageProvider.js';

export * from './StorageProvider.js';
export { MOCK_STORAGE_DIR, caminhoLocalSeguro } from './MockStorageProvider.js';

let instancia: StorageProvider | null = null;

export function storageProviderConfigurado(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME,
  );
}

export function getStorageProvider(): StorageProvider {
  if (instancia) return instancia;
  instancia = storageProviderConfigurado() ? new R2StorageProvider() : new MockStorageProvider();
  return instancia;
}
