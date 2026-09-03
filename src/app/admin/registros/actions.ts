'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { sessaoAtual } from '@/lib/auth'
import { pode } from '@/lib/authz'
import { formatarDocumento } from '@/lib/documento'
import { auditar, banco } from '@/store/repo'

/**
 * Revelação de CPF/CNPJ (invariante I6).
 *
 * O valor completo só é resolvido aqui, no servidor, sob clique explícito, e a
 * revelação vira linha de auditoria com quem, quando e qual registro. Papéis
 * sem a permissão recebem a máscara de volta — não um erro genérico que
 * pudesse ser contornado no cliente.
 */
export async function revelarDocumento(
  registroId: string,
): Promise<{ documento: string } | { erro: string }> {
  const parsed = z.string().min(1).safeParse(registroId)
  if (!parsed.success) return { erro: 'Registro inválido.' }

  const sessao = await sessaoAtual()
  if (!sessao) return { erro: 'Sessão expirada.' }
  if (!pode(sessao.role, 'documento.revelar_cpf')) {
    return { erro: 'Seu papel não tem permissão para revelar documento.' }
  }

  const db = await banco(sessao.tenantId)
  const registro = db.registros.find((r) => r.id === parsed.data)
  if (!registro) return { erro: 'Registro não encontrado neste tenant.' }

  await auditar({
    tenantId: sessao.tenantId, atorUserId: sessao.userId,
    acao: 'documento.revelar_cpf', entidadeTipo: 'registro', entidadeId: registro.id,
    antes: null, depois: { revelado: true, associadoId: registro.associadoId }, ip: '127.0.0.1',
  })

  revalidatePath('/admin/auditoria')
  return { documento: formatarDocumento(registro.cpfCnpj) }
}
