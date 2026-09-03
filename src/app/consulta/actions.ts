'use server'

import { z } from 'zod'
import { STATUS_LABELS, type ProcessStatus } from '@/domain/registros/state-machine'
import { apenasDigitos, validarDocumento } from '@/lib/documento'
import { banco, eventosDoRegistro } from '@/store/repo'

/**
 * Consulta pública: CPF/CNPJ + número do protocolo, sem login.
 *
 * Duas proteções deliberadas:
 *  - o protocolo é obrigatório, então o CPF sozinho não revela nada;
 *  - resposta única para "não encontrado", para que a tela não confirme nem
 *    negue a existência de um CPF na base.
 */

const LIMITE = 5
const JANELA_MS = 60_000

type Balde = { contagem: number; reiniciaEm: number }
const g = globalThis as { __abdcmRate?: Map<string, Balde> }
function baldes(): Map<string, Balde> {
  g.__abdcmRate ??= new Map()
  return g.__abdcmRate
}

function excedeuLimite(chave: string): boolean {
  const agora = Date.now()
  const b = baldes().get(chave)
  if (!b || agora > b.reiniciaEm) {
    baldes().set(chave, { contagem: 1, reiniciaEm: agora + JANELA_MS })
    return false
  }
  b.contagem += 1
  return b.contagem > LIMITE
}

export type Evento = { de: ProcessStatus; para: ProcessStatus; quando: string; descricao: string }
export type ResultadoConsulta = {
  erro?: string
  encontrado?: {
    protocolo: string
    statusAtual: ProcessStatus
    descricao: string
    lote: string
    eventos: Evento[]
  }
}

const Entrada = z.object({
  documento: z.string().min(11),
  protocolo: z.string().min(3),
})

export async function consultar(_e: ResultadoConsulta, form: FormData): Promise<ResultadoConsulta> {
  const parsed = Entrada.safeParse({
    documento: form.get('documento'),
    protocolo: form.get('protocolo'),
  })
  if (!parsed.success) return { erro: 'Informe o CPF/CNPJ e o número do protocolo.' }

  const documento = apenasDigitos(parsed.data.documento)
  if (!validarDocumento(documento)) return { erro: 'CPF/CNPJ inválido.' }

  // Rate limiting por documento consultado: impede varredura da base.
  if (excedeuLimite(documento)) {
    return { erro: 'Muitas consultas em pouco tempo. Tente novamente em um minuto.' }
  }

  const db = banco()
  const registro = db.registros.find(
    (r) => r.cpfCnpj === documento && r.protocolCode?.toUpperCase() === parsed.data.protocolo.trim().toUpperCase(),
  )

  // Mensagem idêntica para protocolo errado e CPF inexistente.
  if (!registro) {
    return { erro: 'Não encontramos um processo com esse CPF/CNPJ e número de protocolo.' }
  }

  const eventos = eventosDoRegistro(registro.id).map((e) => ({
    de: e.deStatus,
    para: e.paraStatus,
    quando: e.ocorridoEm.toLocaleString('pt-BR'),
    descricao: STATUS_LABELS[e.paraStatus],
  }))

  return {
    encontrado: {
      protocolo: registro.protocolCode!,
      statusAtual: registro.processStatus,
      descricao: STATUS_LABELS[registro.processStatus],
      lote: db.lotes.find((l) => l.id === registro.loteId)?.nome ?? '—',
      eventos,
    },
  }
}
