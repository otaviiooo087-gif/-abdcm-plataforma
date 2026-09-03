'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { sessaoAtual } from '@/lib/auth'
import { exigir } from '@/lib/authz'
import { avancarAposPagamento, auditar, banco, doTenant, transicionarRegistro } from '@/store/repo'
import {
  REASON_CODES_CONCILIACAO,
  type ReasonCodeConciliacao,
} from '@/domain/pagamentos/reason-codes'

const Aprovar = z.object({ submissaoId: z.string().min(1) })
const Reprovar = Aprovar.extend({
  reasonCode: z.enum(Object.keys(REASON_CODES_CONCILIACAO) as [ReasonCodeConciliacao]),
  observacao: z.string().min(5, 'A observação é obrigatória e vai literalmente para o parceiro.'),
})

export type EstadoConciliacao = { erro?: string; ok?: string }

export async function aprovarSubmissao(
  _e: EstadoConciliacao, form: FormData,
): Promise<EstadoConciliacao> {
  const sessao = await sessaoAtual()
  if (!sessao) return { erro: 'Sessão expirada.' }
  try {
    exigir(sessao.role, 'conciliacao.aprovar')
  } catch {
    return { erro: 'Seu papel não pode aprovar pagamento.' }
  }

  const parsed = Aprovar.safeParse({ submissaoId: form.get('submissaoId') })
  if (!parsed.success) return { erro: 'Submissão inválida.' }

  const db = banco()
  const sub = doTenant(db.submissoes, sessao.tenantId).find((s) => s.id === parsed.data.submissaoId)
  if (!sub) return { erro: 'Submissão não encontrada neste tenant.' }
  if (sub.paymentStatus === 'pago') return { erro: 'Submissão já conciliada.' }

  const antes = { paymentStatus: sub.paymentStatus }
  sub.paymentStatus = 'pago'
  sub.confirmadoEm = new Date()
  sub.motivoExcecao = null

  // Cada registro transiciona pelo caminho único, gerando seu ProcessEvent (I2),
  // e em seguida avança sozinho para aguardando_protocolo.
  const registros = doTenant(db.registros, sessao.tenantId).filter((r) => r.submissaoId === sub.id)
  for (const r of registros) {
    if (r.processStatus === 'aguardando_pagamento') {
      transicionarRegistro(r, { transicao: 'aprovado', atorTipo: 'admin', atorUserId: sessao.userId })
    } else if (r.processStatus === 'enviado') {
      transicionarRegistro(r, {
        transicao: 'webhook_pix_confirmado', atorTipo: 'admin', atorUserId: sessao.userId,
        metadata: { origem: 'conciliação manual' },
      })
    }
    if (r.processStatus === 'pago') avancarAposPagamento(r)
  }

  auditar({
    tenantId: sessao.tenantId, atorUserId: sessao.userId, atorNome: sessao.nome,
    acao: 'conciliacao.aprovar', entidadeTipo: 'submissao', entidadeId: sub.id,
    antes, depois: { paymentStatus: 'pago', registrosAfetados: registros.length }, ip: '127.0.0.1',
  })

  revalidatePath('/admin/conciliacao')
  revalidatePath('/admin')
  return { ok: `Submissão aprovada. ${registros.length} registros avançaram para aguardando_protocolo.` }
}

export async function reprovarSubmissao(
  _e: EstadoConciliacao, form: FormData,
): Promise<EstadoConciliacao> {
  const sessao = await sessaoAtual()
  if (!sessao) return { erro: 'Sessão expirada.' }
  try {
    exigir(sessao.role, 'conciliacao.reprovar')
  } catch {
    return { erro: 'Seu papel não pode reprovar pagamento.' }
  }

  const parsed = Reprovar.safeParse({
    submissaoId: form.get('submissaoId'),
    reasonCode: form.get('reasonCode'),
    observacao: form.get('observacao'),
  })
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? 'Motivo obrigatório (código + observação).' }
  }

  const db = banco()
  const sub = doTenant(db.submissoes, sessao.tenantId).find((s) => s.id === parsed.data.submissaoId)
  if (!sub) return { erro: 'Submissão não encontrada neste tenant.' }

  const antes = { paymentStatus: sub.paymentStatus }
  sub.paymentStatus = 'reprovado'
  sub.reasonCode = parsed.data.reasonCode
  sub.motivoObservacao = parsed.data.observacao

  const registros = doTenant(db.registros, sessao.tenantId).filter((r) => r.submissaoId === sub.id)
  let afetados = 0
  for (const r of registros) {
    if (r.processStatus === 'aguardando_pagamento') {
      transicionarRegistro(r, {
        transicao: 'rejeitado', atorTipo: 'admin', atorUserId: sessao.userId,
        reasonCode: parsed.data.reasonCode, motivo: parsed.data.observacao,
      })
      afetados++
    }
  }

  auditar({
    tenantId: sessao.tenantId, atorUserId: sessao.userId, atorNome: sessao.nome,
    acao: 'conciliacao.reprovar', entidadeTipo: 'submissao', entidadeId: sub.id, antes,
    depois: { paymentStatus: 'reprovado', reasonCode: parsed.data.reasonCode, observacao: parsed.data.observacao },
    ip: '127.0.0.1',
  })

  revalidatePath('/admin/conciliacao')
  revalidatePath('/admin')
  return { ok: `Submissão reprovada (${REASON_CODES_CONCILIACAO[parsed.data.reasonCode]}). ${afetados} registros voltaram para reprovado. O motivo vai para o parceiro.` }
}
