import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { OcrProvider, DocumentoLido, DocumentoLidoInput } from './OcrProvider.js';
import { valorCredencial } from '../credencialResolver.js';

// CNH costuma vir em PDF (baixada do app do Detran/Serpro), RG geralmente em
// foto — os dois formatos precisam funcionar sem o parceiro converter nada.
// Qualquer outro tipo cai direto na fila de conferência manual, sem chamar a API.
const MIME_TYPES_IMAGEM = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MIME_PDF = 'application/pdf';

const DocumentoSchema = z.object({
  nome: z.string().nullable(),
  cpf: z.string().nullable(),
  tipoDocumento: z.enum(['cnh', 'rg', 'ficha_associativa']).nullable(),
  confianca: z.enum(['alta', 'baixa']),
  assinaturaCoords: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
});

const DOCUMENTO_VAZIO: DocumentoLido = { nome: null, cpf: null, tipoDocumento: null, confianca: 'baixa', assinaturaCoords: null };

const PROMPT_EXTRACAO =
  'Este arquivo é um destes três documentos: uma CNH (Carteira Nacional de Habilitação) ' +
  'brasileira, um RG brasileiro, ou uma Ficha Associativa da ABDCM (formulário de filiação ' +
  'preenchido, com nome e CPF do associado impressos ou digitados nele). Pode ser uma foto ou ' +
  'um PDF (a CNH costuma vir em PDF baixado do app do Detran/Serpro). O parceiro não separou os ' +
  'arquivos por tipo, então identifique você qual é. Extraia o nome completo da pessoa, o ' +
  'número de CPF e o tipo do documento ("cnh", "rg" ou "ficha_associativa"). Retorne o CPF só ' +
  'com os 11 dígitos, sem pontuação nem traço. Se não conseguir ler o nome, o CPF ou identificar ' +
  'o tipo com clareza, retorne null nesse campo — nunca invente ou complete dígitos que não ' +
  'conseguiu ver, nem chute o tipo se o documento não deixar claro. Use confianca "alta" ' +
  'somente quando o CPF tiver os 11 dígitos claramente legíveis e sem ambiguidade; em ' +
  'qualquer outro caso, use "baixa". Além disso, se for uma foto (nunca em PDF) e houver uma ' +
  'ASSINATURA manuscrita visível no documento, localize seu retângulo e retorne em ' +
  'assinaturaCoords como [ymin, xmin, ymax, xmax], normalizado de 0 a 1000 em relação ao ' +
  'tamanho da imagem, com origem no canto superior esquerdo. Se não houver assinatura visível ' +
  'ou o arquivo for um PDF, retorne null nesse campo.';

export class ClaudeOcrProvider implements OcrProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: valorCredencial('ocr_claude', 'ANTHROPIC_API_KEY') });
  }

  async lerDocumento(input: DocumentoLidoInput): Promise<DocumentoLido> {
    const ehImagem = MIME_TYPES_IMAGEM.has(input.mimeType);
    const ehPdf = input.mimeType === MIME_PDF;
    if (!ehImagem && !ehPdf) {
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
              ehPdf
                ? { type: 'document', source: { type: 'url', url: input.documentoUrl } }
                : { type: 'image', source: { type: 'url', url: input.documentoUrl } },
              { type: 'text', text: PROMPT_EXTRACAO },
            ],
          },
        ],
      });

      const parsed = response.parsed_output;
      if (!parsed) return DOCUMENTO_VAZIO;

      const coords = parsed.assinaturaCoords;
      const assinaturaCoords: [number, number, number, number] | null =
        ehImagem && coords && coords.length === 4 && coords.every((n) => typeof n === 'number')
          ? [coords[0]!, coords[1]!, coords[2]!, coords[3]!]
          : null;

      return {
        nome: parsed.nome?.trim() || null,
        cpf: parsed.cpf ? parsed.cpf.replace(/\D/g, '') : null,
        tipoDocumento: parsed.tipoDocumento,
        confianca: parsed.confianca,
        assinaturaCoords,
      };
    } catch (err) {
      console.error('[ClaudeOcrProvider] falha ao ler documento:', err);
      return DOCUMENTO_VAZIO;
    }
  }
}
