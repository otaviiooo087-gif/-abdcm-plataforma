import type { OcrProvider } from './OcrProvider.js';
import { MockOcrProvider } from './MockOcrProvider.js';
import { ClaudeOcrProvider } from './ClaudeOcrProvider.js';
import { credencialNoBanco } from '../credencialResolver.js';

export * from './OcrProvider.js';

let instancia: OcrProvider | null = null;
let instanciaEraReal = false;

/** true quando o provedor real está configurado (chave no banco, ou env var) — usado pela UI de Configurações. */
export function ocrProviderConfigurado(): boolean {
  if (credencialNoBanco('ocr_claude', 'ANTHROPIC_API_KEY')) return true;
  return process.env.OCR_PROVIDER === 'real' && Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getOcrProvider(): OcrProvider {
  const real = ocrProviderConfigurado();
  if (!instancia || real !== instanciaEraReal) {
    instancia = real ? new ClaudeOcrProvider() : new MockOcrProvider();
    instanciaEraReal = real;
  }
  return instancia;
}
