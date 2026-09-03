'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { abrirSessao, conferirSenha, encerrarSessao } from '@/lib/auth'
import { pode } from '@/lib/authz'
import { auditar, bancoTenantPadrao } from '@/store/repo'

const Entrada = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  senha: z.string().min(8, 'A senha tem no mínimo 8 caracteres.'),
})

export type EstadoLogin = { erro?: string }

/**
 * Autenticação inteiramente no servidor (invariante I1): o cliente envia
 * e-mail e senha, e recebe de volta apenas um cookie de sessão assinado.
 * Nem o papel nem as permissões trafegam como dado confiável do navegador.
 */
export async function entrar(_estado: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const parsed = Entrada.safeParse({ email: form.get('email'), senha: form.get('senha') })
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const db = await bancoTenantPadrao()
  const user = db.users.find((u) => u.email === parsed.data.email.toLowerCase().trim())

  // Mensagem única para usuário inexistente e senha errada: não confirmamos
  // a existência de um cadastro para quem não se autenticou.
  const generico = 'E-mail ou senha incorretos.'
  if (!user || !user.isActive || !user.passwordHash || !conferirSenha(parsed.data.senha, user.passwordHash)) {
    return { erro: generico }
  }

  const parceiro = db.parceiros.find((p) => p.userId === user.id)

  await abrirSessao({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    nome: user.nome,
    email: user.email,
    parceiroId: parceiro?.id ?? null,
    impersonandoParceiroId: null,
  })

  await auditar({
    tenantId: user.tenantId, atorUserId: user.id, acao: 'sessao.login',
    entidadeTipo: 'user', entidadeId: user.id, antes: null,
    depois: { role: user.role }, ip: '127.0.0.1',
  })

  redirect(pode(user.role, 'portal.parceiro') ? '/app' : '/admin')
}

export async function sair(): Promise<void> {
  await encerrarSessao()
  redirect('/login')
}
