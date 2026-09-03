import { describe, expect, it } from 'vitest'
import {
  PROCESS_STATUSES,
  TRANSICOES,
  aplicarTransicao,
  MotivoObrigatorioError,
  podeTransicionar,
  TransicaoProibidaError,
  type ProcessStatus,
  type Transicao,
} from './state-machine'

const base = {
  registroId: 'reg-1',
  tenantId: 'tenant-abdcm',
  atorTipo: 'admin' as const,
  atorUserId: 'user-1',
}

/** As 11 transições válidas da especificação, com o par (de → para) esperado. */
const VALIDAS: Array<[ProcessStatus, Transicao, ProcessStatus]> = [
  ['pendente', 'enviar_lista', 'enviado'],
  ['enviado', 'webhook_pix_confirmado', 'pago'],
  ['enviado', 'comprovante_manual_anexado', 'aguardando_pagamento'],
  ['aguardando_pagamento', 'aprovado', 'pago'],
  ['aguardando_pagamento', 'rejeitado', 'reprovado'],
  ['reprovado', 'novo_comprovante', 'aguardando_pagamento'],
  ['reprovado', 'comprovante_manual_anexado', 'aguardando_pagamento'],
  ['pago', 'automatico', 'aguardando_protocolo'],
  ['aguardando_protocolo', 'protocolo_registrado', 'protocolado'],
  ['protocolado', 'retorno_baixado', 'baixado'],
  ['protocolado', 'retorno_recusado', 'recusado'],
]

const motivoQuandoPreciso = (t: Transicao) =>
  ['rejeitado', 'retorno_recusado', 'excecao_admin'].includes(t)
    ? { reasonCode: 'dados_nao_conferem', motivo: 'observação de teste' }
    : {}

describe('máquina de estados — transições válidas', () => {
  it.each(VALIDAS)('%s --[%s]--> %s', (de, transicao, esperado) => {
    const r = aplicarTransicao({ ...base, de, transicao, ...motivoQuandoPreciso(transicao) })
    expect(r.paraStatus).toBe(esperado)
  })

  it('exceção administrativa cancela a partir de qualquer status', () => {
    for (const de of PROCESS_STATUSES) {
      if (de === 'cancelado') continue
      const r = aplicarTransicao({
        ...base,
        de,
        transicao: 'excecao_admin',
        reasonCode: 'cancelamento_administrativo',
        motivo: 'pedido do parceiro',
      })
      expect(r.paraStatus).toBe('cancelado')
    }
  })
})

describe('máquina de estados — transições proibidas (matriz completa)', () => {
  const permitidas = new Set(VALIDAS.map(([de, t]) => `${de}|${t}`))

  const proibidas: Array<[ProcessStatus, Transicao]> = []
  for (const de of PROCESS_STATUSES) {
    for (const t of TRANSICOES) {
      if (t === 'excecao_admin' && de !== 'cancelado') continue
      if (permitidas.has(`${de}|${t}`)) continue
      proibidas.push([de, t])
    }
  }

  it('a matriz cobre todos os pares status × transição', () => {
    expect(proibidas.length + permitidas.size + (PROCESS_STATUSES.length - 1)).toBe(
      PROCESS_STATUSES.length * TRANSICOES.length,
    )
  })

  it.each(proibidas)('%s --[%s]--> PROIBIDA', (de, transicao) => {
    expect(podeTransicionar(de, transicao)).toBe(false)
    expect(() =>
      aplicarTransicao({ ...base, de, transicao, ...motivoQuandoPreciso(transicao) }),
    ).toThrow(TransicaoProibidaError)
  })

  it('status final não regride: baixado não volta para protocolado', () => {
    expect(podeTransicionar('baixado', 'protocolo_registrado')).toBe(false)
  })

  it('webhook fora de ordem não regride status já pago', () => {
    expect(() =>
      aplicarTransicao({ ...base, de: 'pago', transicao: 'webhook_pix_confirmado' }),
    ).toThrow(TransicaoProibidaError)
  })
})

describe('invariante I2 — toda transição produz ProcessEvent', () => {
  it('o evento acompanha o novo status, com ator, motivo e timestamp', () => {
    const agora = new Date('2026-01-15T12:00:00Z')
    const r = aplicarTransicao({
      ...base,
      de: 'aguardando_pagamento',
      transicao: 'rejeitado',
      reasonCode: 'valor_divergente',
      motivo: 'pagou R$ 180 de R$ 240',
      agora,
    })
    expect(r.evento).toMatchObject({
      registroId: 'reg-1',
      tenantId: 'tenant-abdcm',
      deStatus: 'aguardando_pagamento',
      paraStatus: 'reprovado',
      atorTipo: 'admin',
      atorUserId: 'user-1',
      reasonCode: 'valor_divergente',
      ocorridoEm: agora,
    })
  })

  it('o resultado é imutável — não dá para trocar o status sem o evento', () => {
    const r = aplicarTransicao({ ...base, de: 'pendente', transicao: 'enviar_lista' })
    expect(Object.isFrozen(r)).toBe(true)
  })

  it('nenhuma transição válida devolve resultado sem evento', () => {
    for (const [de, transicao] of VALIDAS) {
      const r = aplicarTransicao({ ...base, de, transicao, ...motivoQuandoPreciso(transicao) })
      expect(r.evento.paraStatus).toBe(r.paraStatus)
      expect(r.evento.deStatus).toBe(de)
    }
  })
})

describe('invariante I11 — ação destrutiva exige reason_code + observação', () => {
  it.each(['rejeitado', 'retorno_recusado'] as const)('%s sem motivo falha', (transicao) => {
    const de: ProcessStatus = transicao === 'rejeitado' ? 'aguardando_pagamento' : 'protocolado'
    expect(() => aplicarTransicao({ ...base, de, transicao })).toThrow(MotivoObrigatorioError)
  })

  it('cancelamento sem motivo falha', () => {
    expect(() =>
      aplicarTransicao({ ...base, de: 'pendente', transicao: 'excecao_admin' }),
    ).toThrow(MotivoObrigatorioError)
  })

  it('reason_code sem observação livre também falha', () => {
    expect(() =>
      aplicarTransicao({
        ...base,
        de: 'aguardando_pagamento',
        transicao: 'rejeitado',
        reasonCode: 'comprovante_ilegivel',
      }),
    ).toThrow(MotivoObrigatorioError)
  })
})
