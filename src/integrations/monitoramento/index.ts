import type { MonitoramentoProvider } from './MonitoramentoProvider.js';
import { MockMonitoramentoProvider } from './MockMonitoramentoProvider.js';
import { JuditMonitoramentoProvider } from './JuditMonitoramentoProvider.js';
import { credencialNoBanco } from '../credencialResolver.js';

export * from './MonitoramentoProvider.js';

let instancia: MonitoramentoProvider | null = null;
let instanciaEraReal = false;

/** true quando o provedor real está configurado (chave no banco, ou env var) — usado pela UI de Configurações. */
export function monitoramentoProviderConfigurado(): boolean {
  if (credencialNoBanco('monitoramento_judit', 'JUDIT_API_KEY')) return true;
  return process.env.MONITORAMENTO_PROVIDER === 'real' && Boolean(process.env.JUDIT_API_KEY);
}

export function getMonitoramentoProvider(): MonitoramentoProvider {
  const real = monitoramentoProviderConfigurado();
  if (!instancia || real !== instanciaEraReal) {
    instancia = real ? new JuditMonitoramentoProvider() : new MockMonitoramentoProvider();
    instanciaEraReal = real;
  }
  return instancia;
}
