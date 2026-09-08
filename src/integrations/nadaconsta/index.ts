import type { NadaConstaProvider } from './NadaConstaProvider.js'
import { MockNadaConstaProvider } from './MockNadaConstaProvider.js'

export * from './NadaConstaProvider.js'

let instancia: NadaConstaProvider | null = null

/**
 * Só existe o provedor mock por enquanto — nenhum birô real está
 * contratado (ver comentário em NadaConstaProvider.ts). Quando existir,
 * este arquivo ganha o mesmo branch por variável de ambiente que
 * PIX/WhatsApp/OCR já usam.
 */
export function getNadaConstaProvider(): NadaConstaProvider {
  if (instancia) return instancia
  instancia = new MockNadaConstaProvider()
  return instancia
}
