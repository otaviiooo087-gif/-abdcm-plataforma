import type { OcrProvider, DocumentoLido, DocumentoLidoInput } from './OcrProvider.js';

// Provedor de desenvolvimento: não lê nada de verdade (sem conta configurada,
// e mesmo com o provedor real, uma URL de storage mock não é alcançável de
// fora) — todo arquivo cai na fila de conferência manual, que é exatamente o
// caminho que precisa funcionar mesmo sem o provedor real.
export class MockOcrProvider implements OcrProvider {
  async lerDocumento(_input: DocumentoLidoInput): Promise<DocumentoLido> {
    void _input;
    return { nome: null, cpf: null, tipoDocumento: null, confianca: 'baixa', assinaturaCoords: null };
  }
}
