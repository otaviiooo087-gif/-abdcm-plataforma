import 'server-only'
import { redirect } from 'next/navigation'
import { sessaoAtual, type Sessao } from './auth'
import { pode, type Permissao } from './authz'

/**
 * Guarda de rota. Toda página protegida chama isto no servidor antes de
 * renderizar qualquer dado (invariante I1). Não existe checagem de permissão
 * no cliente — o que o navegador recebe já veio filtrado.
 */
export async function exigirSessao(permissao?: Permissao): Promise<Sessao> {
  const sessao = await sessaoAtual()
  if (!sessao) redirect('/login')
  if (permissao && !pode(sessao.role, permissao)) redirect('/sem-permissao')
  return sessao
}
