// Interface do leitor de documentos (CNH/RG) por visão computacional.
// Nenhum SDK de terceiro deve vazar pra fora de src/integrations/ocr — o
// resto do sistema só conhece este contrato. Usado no anexo em massa de
// documentos: em vez do parceiro organizar arquivos em pastas nomeadas por
// CPF, o sistema lê o nome e o CPF direto da imagem.
//
// Recebe uma URL (a mesma URL assinada de download que o storage já gera —
// StorageProvider.criarUrlDownload), nunca os bytes do arquivo: o servidor
// não baixa o documento pra si, só entrega a URL pro provedor de OCR buscar.
// Em modo mock de storage essa URL é relativa (só o navegador resolve), então
// o provedor real de OCR só funciona de fato com o storage real configurado.
//
// O resultado NUNCA é gravado direto — sempre passa por uma tela de
// conferência humana antes de qualquer associação documento→associado (I3).
// Confiança "baixa" ou CPF/nome não lidos jogam o arquivo pra fila de
// conferência manual, nunca descartam silenciosamente.

export interface DocumentoLidoInput {
  imagemUrl: string;
  mimeType: string;
}

export interface DocumentoLido {
  nome: string | null;
  cpf: string | null;
  /** 'alta' só quando o CPF foi lido com todos os 11 dígitos claros e sem ambiguidade. */
  confianca: 'alta' | 'baixa';
}

export interface OcrProvider {
  lerDocumento(input: DocumentoLidoInput): Promise<DocumentoLido>;
}
