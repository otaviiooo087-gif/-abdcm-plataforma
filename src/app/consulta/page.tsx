import { formatarDocumento } from '@/lib/documento'
import { bancoTenantPadrao } from '@/store/repo'
import { FormConsulta } from './form'

// Consulta o banco a cada requisição: com Postgres real, gerar esta página
// uma vez no build congelaria o exemplo para sempre (e exigiria DATABASE_URL
// disponível no momento do build, não só em produção).
export const dynamic = 'force-dynamic'

export default async function ConsultaPublica() {
  // Exemplo pré-preenchido apenas para a demonstração da Fase 0.
  const db = await bancoTenantPadrao()
  const r = db.registros.find((x) => x.protocolCode && x.processStatus === 'baixado')
  const exemplo = r ? { documento: formatarDocumento(r.cpfCnpj), protocolo: r.protocolCode! } : null

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-azul">ABDCM</p>
      <h1 className="mt-2 text-2xl font-semibold text-marinho">Consulta pública de processo</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
        Informe o CPF/CNPJ e o número do protocolo para acompanhar a ação coletiva. Sem cadastro e
        sem login, com limite de consultas por minuto.
      </p>

      <div className="mt-6">
        <FormConsulta exemplo={exemplo} />
      </div>
    </main>
  )
}
