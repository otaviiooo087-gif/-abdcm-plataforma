// Quais documentos cada tipo de associado precisa anexar — CPF usa CNH/RG,
// CNJP não tem esses dois, usa o comprovante de inscrição no lugar. Ficha
// associativa vale pros dois. Compartilhado entre as telas que mostram
// status/visualização de documentos (Enviar Limpa Nome, Minhas Listas).

export interface StatusDocumentos {
  cnh: boolean;
  rg: boolean;
  comprovante_inscricao: boolean;
  ficha_associativa: boolean;
}

export function documentosEsperados(tipoDocumento: 'cpf' | 'cnpj'): { tipo: keyof StatusDocumentos; label: string }[] {
  return tipoDocumento === 'cnpj'
    ? [
        { tipo: 'comprovante_inscricao', label: 'Comprovante de Inscrição (CNPJ)' },
        { tipo: 'ficha_associativa', label: 'Ficha Associativa' },
      ]
    : [
        { tipo: 'cnh', label: 'CNH' },
        { tipo: 'rg', label: 'RG' },
        { tipo: 'ficha_associativa', label: 'Ficha Associativa' },
      ];
}

/** Sobe um arquivo local pro storage de staging (sem associado nem tipo
 * ainda conhecidos — só depois de lido por OCR é que se sabe do que se
 * trata). Compartilhado entre toda tela que anexa CNH/RG por upload direto
 * (Importar Lista, Cadastrar por Documento). */
export async function stageArquivo(file: File): Promise<{ key: string; mimeType: string; nomeArquivo: string }> {
  const mimeType = file.type || 'application/octet-stream';
  const presignRes = await fetch('/api/documentos/staging/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mimeType }),
  });
  const presignData = await presignRes.json();
  if (!presignRes.ok) throw new Error(presignData.error || 'Falha ao autorizar upload');

  const uploadRes = await fetch(presignData.uploadUrl, {
    method: 'PUT',
    headers: presignData.headers || {},
    body: file,
  });
  if (!uploadRes.ok) throw new Error('Falha ao enviar o arquivo pro armazenamento');

  return { key: presignData.key, mimeType, nomeArquivo: file.name };
}
