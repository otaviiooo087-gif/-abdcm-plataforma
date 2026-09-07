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
  confianca: z.enum(['alta', 'baixa']),
});

const PROMPT_EXTRACAO =
  'Esta imagem é uma CNH (Carteira Nacional de Habilitação) ou um RG brasileiro. ' +
  'Extraia o nome completo do titular e o número de CPF. Retorne o CPF só com os 11 ' +
  'dígitos, sem pontuação nem traço. Se não conseguir ler o nome ou o CPF com clareza, ' +
  'retorne null nesse campo — nunca invente ou complete dígitos que não conseguiu ver. ' +
  'Use confianca "alta" somente quando o CPF tiver os 11 dígitos claramente legíveis e ' +
  'sem ambiguidade; em qualquer outro caso, use "baixa".';

export class ClaudeOcrProvider implements OcrProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async lerDocumento(input: DocumentoLidoInput): Promise<DocumentoLido> {
    if (!MIME_TYPES_SUPORTADOS.has(input.mimeType)) {
      return { nome: null, cpf: null, confianca: 'baixa' };
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
      if (!parsed) return { nome: null, cpf: null, confianca: 'baixa' };

      return {
        nome: parsed.nome?.trim() || null,
        cpf: parsed.cpf ? parsed.cpf.replace(/\D/g, '') : null,
        confianca: parsed.confianca,
      };
    } catch (err) {
      console.error('[ClaudeOcrProvider] falha ao ler documento:', err);
      return { nome: null, cpf: null, confianca: 'baixa' };
    }
  }
}
