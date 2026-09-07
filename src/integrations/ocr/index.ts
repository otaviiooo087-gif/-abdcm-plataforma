import type { OcrProvider } from './OcrProvider.js';
import { MockOcrProvider } from './MockOcrProvider.js';
import { ClaudeOcrProvider } from './ClaudeOcrProvider.js';

export * from './OcrProvider.js';

let instancia: OcrProvider | null = null;

/** true quando o provedor real está configurado (chave presente) — usado pela UI de Configurações. */
export function ocrProviderConfigurado(): boolean {
  return process.env.OCR_PROVIDER === 'real' && Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getOcrProvider(): OcrProvider {
  if (instancia) return instancia;
  instancia = ocrProviderConfigurado() ? new ClaudeOcrProvider() : new MockOcrProvider();
  return instancia;
}
