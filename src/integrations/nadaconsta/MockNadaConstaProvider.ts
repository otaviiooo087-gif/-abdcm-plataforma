import type { NadaConstaProvider } from './NadaConstaProvider.js'

function gerarProtocolo(): string {
  const ano = new Date().getFullYear()
  const aleatorio = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `NC-${ano}-${aleatorio}`
}

/** Simula a emissão — gera um certificado em HTML, sem nenhuma consulta real a birô. */
export class MockNadaConstaProvider implements NadaConstaProvider {
  async emitir(input: { nome: string; cpfCnpj: string; registroId: string }) {
    const protocoloConsulta = gerarProtocolo()
    const emitidoEm = new Date()
    const dataFormatada = emitidoEm.toLocaleDateString('pt-BR')

    const documentoHtml = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Certidão de Nada Consta — ${protocoloConsulta}</title>
<style>
  body { font-family: Georgia, serif; background: #f8fafc; padding: 48px; color: #1e293b; }
  .certidao { max-width: 640px; margin: 0 auto; background: white; border: 2px solid #106778; border-radius: 12px; padding: 40px; text-align: center; }
  h1 { color: #106778; font-size: 20px; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 4px; }
  .selo { width: 64px; height: 64px; border-radius: 50%; background: #10677815; color: #106778; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 32px; }
  .linha { text-align: left; margin: 20px 0; font-size: 14px; line-height: 1.7; }
  .protocolo { font-family: monospace; background: #f1f5f9; padding: 8px 12px; border-radius: 6px; font-size: 13px; margin-top: 24px; }
  .rodape { margin-top: 32px; font-size: 11px; color: #64748b; }
</style>
</head>
<body>
  <div class="certidao">
    <div class="selo">&#10003;</div>
    <h1>Certidão de Nada Consta</h1>
    <p style="color:#64748b;font-size:12px;">Emitida por ABDCM — Associação Brasileira de Defesa do Consumidor</p>
    <div class="linha">
      <p><strong>Nome/Razão Social:</strong> ${input.nome}</p>
      <p><strong>CPF/CNPJ:</strong> ${input.cpfCnpj}</p>
      <p><strong>Registro:</strong> ${input.registroId}</p>
      <p><strong>Emitido em:</strong> ${dataFormatada}</p>
    </div>
    <p style="font-size:13px;line-height:1.6;">
      Certificamos que, na data acima, não constam restrições de crédito em nome do
      titular junto aos órgãos de proteção ao crédito consultados (Serasa, Boa Vista,
      SPC Brasil, Cenprot BR e Cenprot SP), referente ao processo desta Ação Coletiva.
    </p>
    <p class="protocolo">Protocolo de consulta: ${protocoloConsulta}</p>
    <p class="rodape">Documento gerado automaticamente pelo sistema ABDCM — modo simulação (sem integração real com os birôs de crédito).</p>
  </div>
</body>
</html>`

    return {
      protocoloConsulta,
      documentoBase64: Buffer.from(documentoHtml, 'utf8').toString('base64'),
      mimeType: 'text/html',
      emitidoEm,
    }
  }
}
