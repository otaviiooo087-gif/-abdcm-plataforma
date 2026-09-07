// Interface do provedor de armazenamento de arquivos (CNH/RG, fichas
// assinadas). O padrão de upload é sempre indireto: o servidor nunca recebe
// o arquivo em si (inviável em volume — uma leva de 10 mil associados passa
// fácil de 20GB) — ele só autoriza (URL assinada) e o navegador manda o
// arquivo direto pro storage.

export interface CriarUrlUploadInput {
  key: string;
  contentType: string;
  expiraEmSegundos: number;
}

export interface UrlUpload {
  uploadUrl: string;
  /** Headers que o navegador precisa mandar junto do PUT (ex.: Content-Type). */
  headers?: Record<string, string>;
}

export interface StorageProvider {
  criarUrlUpload(input: CriarUrlUploadInput): Promise<UrlUpload>;
  criarUrlDownload(key: string, expiraEmSegundos: number): Promise<string>;
  excluir(key: string): Promise<void>;
}
