import { Invariante } from '@/components/ui'
import { exigirSessao } from '@/lib/sessao-guard'
import { banco } from '@/store/repo'
import type { AuditLog } from '@/store/schema'

const ACOES: Record<string, string> = {
  'sessao.login': 'Login',
  'documento.revelar_cpf': 'Revelação de CPF/CNPJ',
  'conciliacao.aprovar': 'Aprovação de pagamento',
  'conciliacao.reprovar': 'Reprovação de pagamento',
}

export default async function Auditoria() {
  const sessao = await exigirSessao('auditoria.ver')
  const db = await banco(sessao.tenantId)
  const linhas: AuditLog[] = db.auditLog

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-marinho">Auditoria</h1>
        <p className="mt-1 text-sm text-slate-600">
          Log imutável com diff antes/depois em cada linha. Só recebe append — não existe update
          nem delete, nem pela aplicação nem pelo banco.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-borda bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-borda bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Quando</th>
              <th className="px-4 py-2">Ator</th>
              <th className="px-4 py-2">Ação</th>
              <th className="px-4 py-2">Entidade</th>
              <th className="px-4 py-2">Antes</th>
              <th className="px-4 py-2">Depois</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {linhas.map((l) => (
              <tr key={l.id} className="align-top">
                <td className="px-4 py-2 text-xs tabular-nums text-slate-600">
                  {l.ocorridoEm.toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-2 text-xs">{l.atorNome}</td>
                <td className="px-4 py-2 text-xs font-medium text-marinho">{ACOES[l.acao] ?? l.acao}</td>
                <td className="px-4 py-2 font-mono text-[11px] text-slate-600">
                  {l.entidadeTipo}/{l.entidadeId}
                </td>
                <td className="px-4 py-2 font-mono text-[11px] text-slate-500">
                  {l.antes ? JSON.stringify(l.antes) : '—'}
                </td>
                <td className="px-4 py-2 font-mono text-[11px] text-slate-700">
                  {l.depois ? JSON.stringify(l.depois) : '—'}
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  Ainda sem eventos nesta sessão. Faça login com outro papel, revele um CPF na ficha
                  de um registro ou aprove um item da conciliação — cada ação aparece aqui.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-borda bg-white p-4">
        <Invariante codigo="I6">
          Toda revelação de CPF/CNPJ vira uma linha aqui, com quem revelou, quando e qual registro.
          É o que transforma a máscara em controle verificável em vez de enfeite de tela.
        </Invariante>
      </div>
    </div>
  )
}
