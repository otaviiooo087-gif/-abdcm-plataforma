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
  /** Aceita tanto foto (jpg/png/webp) quanto PDF — CNH costuma vir em PDF
   * (download do app do Detran/Serpro), RG geralmente em foto. */
  documentoUrl: string;
  mimeType: string;
}

export interface DocumentoLido {
  nome: string | null;
  cpf: string | null;
  /** Tipo do documento identificado na própria imagem — o parceiro não
   * precisa mais dizer se é CNH, RG ou Ficha Associativa antes de enviar, o
   * sistema classifica sozinho. null quando não dá pra saber com clareza
   * (cai pra escolha manual). */
  tipoDocumento: 'cnh' | 'rg' | 'ficha_associativa' | null;
  /** 'alta' só quando o CPF foi lido com todos os 11 dígitos claros e sem ambiguidade. */
  confianca: 'alta' | 'baixa';
  /** Retângulo da assinatura manuscrita encontrada no documento, normalizado
   * de 0 a 1000 no formato [ymin, xmin, ymax, xmax] (origem no canto
   * superior esquerdo da imagem). Só faz sentido para foto (nunca PDF) —
   * usado só para POSICIONAR uma cópia visual da assinatura na ficha
   * associativa gerada automaticamente (src/domain/associados/ficha.ts).
   * Isso NUNCA é o que comprova o consentimento do associado (I5) — a prova
   * real é o registro separado de consentimento_em/ip/hash gravado no
   * momento da geração; a imagem é só um facilitador visual. null quando não
   * encontrou assinatura no documento. */
  assinaturaCoords: [number, number, number, number] | null;
}

export interface OcrProvider {
  lerDocumento(input: DocumentoLidoInput): Promise<DocumentoLido>;
}
