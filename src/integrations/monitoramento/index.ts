import type { MonitoramentoProvider } from './MonitoramentoProvider.js';
import { MockMonitoramentoProvider } from './MockMonitoramentoProvider.js';
import { JuditMonitoramentoProvider } from './JuditMonitoramentoProvider.js';

export * from './MonitoramentoProvider.js';

let instancia: MonitoramentoProvider | null = null;

/** true quando o provedor real está configurado (chave presente) — usado pela UI de Configurações. */
export function monitoramentoProviderConfigurado(): boolean {
  return process.env.MONITORAMENTO_PROVIDER === 'real' && Boolean(process.env.JUDIT_API_KEY);
}

export function getMonitoramentoProvider(): MonitoramentoProvider {
  if (instancia) return instancia;
  instancia = monitoramentoProviderConfigurado() ? new JuditMonitoramentoProvider() : new MockMonitoramentoProvider();
  return instancia;
}
