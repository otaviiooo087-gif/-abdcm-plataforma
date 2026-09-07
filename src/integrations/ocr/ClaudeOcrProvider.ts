import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { OcrProvider, DocumentoLido, DocumentoLidoInput } from './OcrProvider.js';

// Só esses tipos de imagem a API da Anthropic aceita — PDF (raro em CNH/RG
// de foto de celular) e qualquer outro tipo cai direto na fila de
// conferência manual, sem chamar a API.
const MIME_TYPES_SUPORTADOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const DocumentoSchema = z.object({
  nome: z.string().nullable(),
  cpf: z.string().nullable(),
  tipoDocumento: z.enum(['cnh', 'rg']).nullable(),
  confianca: z.enum(['alta', 'baixa']),
});

const DOCUMENTO_VAZIO: DocumentoLido = { nome: null, cpf: null, tipoDocumento: null, confianca: 'baixa' };

const PROMPT_EXTRACAO =
  'Esta imagem é uma CNH (Carteira Nacional de Habilitação) ou um RG brasileiro — o parceiro ' +
  'não separou os arquivos por tipo, então identifique você qual é. Extraia o nome completo ' +
  'do titular, o número de CPF e o tipo do documento ("cnh" ou "rg"). Retorne o CPF só com os ' +
  '11 dígitos, sem pontuação nem traço. Se não conseguir ler o nome, o CPF ou identificar o ' +
  'tipo com clareza, retorne null nesse campo — nunca invente ou complete dígitos que não ' +
  'conseguiu ver, nem chute o tipo se a imagem não deixar claro. Use confianca "alta" somente ' +
  'quando o CPF tiver os 11 dígitos claramente legíveis e sem ambiguidade; em qualquer outro ' +
  'caso, use "baixa".';

export class ClaudeOcrProvider implements OcrProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async lerDocumento(input: DocumentoLidoInput): Promise<DocumentoLido> {
    if (!MIME_TYPES_SUPORTADOS.has(input.mimeType)) {
      return DOCUMENTO_VAZIO;
    }

    try {
      const response = await this.client.messages.parse({
        model: 'claude-opus-5',
        max_tokens: 512,
        output_config: { effort: 'low', format: zodOutputFormat(DocumentoSchema) },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'url', url: input.imagemUrl },
              },
              { type: 'text', text: PROMPT_EXTRACAO },
            ],
          },
        ],
      });

      const parsed = response.parsed_output;
      if (!parsed) return DOCUMENTO_VAZIO;

      return {
        nome: parsed.nome?.trim() || null,
        cpf: parsed.cpf ? parsed.cpf.replace(/\D/g, '') : null,
        tipoDocumento: parsed.tipoDocumento,
        confianca: parsed.confianca,
      };
    } catch (err) {
      console.error('[ClaudeOcrProvider] falha ao ler documento:', err);
      return DOCUMENTO_VAZIO;
    }
  }
}
