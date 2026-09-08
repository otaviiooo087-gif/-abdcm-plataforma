import type { LigacaoProvider } from './LigacaoProvider.js';
import { MockLigacaoProvider } from './MockLigacaoProvider.js';

export * from './LigacaoProvider.js';

let instancia: LigacaoProvider | null = null;

// Sempre mock — nenhum provedor real de telefonia/IVR está contratado
// (CLAUDE.md seção 8). Quando um dia existir um provider real, o padrão é
// o mesmo dos outros: ligacaoProviderConfigurado() checando as env vars e
// trocando aqui, sem tocar em quem chama getLigacaoProvider().
export function ligacaoProviderConfigurado(): boolean {
  return false;
}

export function getLigacaoProvider(): LigacaoProvider {
  if (instancia) return instancia;
  instancia = new MockLigacaoProvider();
  return instancia;
}
