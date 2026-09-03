import { redirect } from 'next/navigation'
import { sessaoAtual } from '@/lib/auth'
import { pode } from '@/lib/authz'
import { SENHA_DEMO } from '@/store/seed'
import { FormLogin } from './form'

export default async function LoginPage() {
  const sessao = await sessaoAtual()
  if (sessao) redirect(pode(sessao.role, 'portal.parceiro') ? '/app' : '/admin')

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-fundo px-4 py-10">
      <FormLogin senhaDemo={SENHA_DEMO} />
    </main>
  )
}
