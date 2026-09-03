import { Invariante } from '@/components/ui'
import { IconPlus, IconUpload, IconUsers } from '@/components/icons'
import { exigirSessao } from '@/lib/sessao-guard'
import { formatarDocumento } from '@/lib/documento'
import { banco, doTenant } from '@/store/repo'
import { TabelaAssociados, type LinhaAssociado } from './tabela'

export default async function Associados() {
  const sessao = await exigirSessao('portal.parceiro')
  const db = await banco(sessao.tenantId)

  const associados = doTenant(db.associados, sessao.tenantId).filter(
    (a) => a.parceiroId === sessao.parceiroId,
  )

  const linhas: LinhaAssociado[] = associados.map((a) => ({
    id: a.id,
    nome: a.nome,
    // No portal, o parceiro vê o documento de quem ele mesmo filiou — a
    // máscara padrão (I6) é exigida nas telas administrativas, não aqui.
    documento: formatarDocumento(a.cpfCnpj),
    tipo: a.tipoDocumento,
    statusFiliacao: a.statusFiliacao,
    dataReferencia: a.consentimentoEm
      ? a.consentimentoEm.toLocaleDateString('pt-BR')
      : '—',
  }))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-azul-claro text-azul">
            <IconUsers className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-marinho">Associados</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              O cliente não compra um serviço: ele se filia à ABDCM. A ficha associativa é, ao
              mesmo tempo, o instrumento de filiação e o consentimento LGPD para tratamento do CPF.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          disabled
          title="Cadastro individual chega na Fase 1"
          className="flex items-center gap-2 rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white transition enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconPlus className="h-4 w-4" />
          Cadastrar Associado
        </button>
        <button
          disabled
          title="Importação de planilha chega na Fase 1"
          className="flex items-center gap-2 rounded-lg border border-borda bg-white px-4 py-2 text-sm font-semibold text-marinho transition enabled:hover:border-azul enabled:hover:text-azul disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconUpload className="h-4 w-4" />
          Importar Lista (Excel)
        </button>
        <span className="text-xs text-slate-400">
          Cadastro individual e importação de planilha chegam na Fase 1.
        </span>
      </div>

      <section className="rounded-xl border border-borda bg-white p-4">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-marinho">
            Associados cadastrados <span className="font-normal text-slate-400">({linhas.length} total)</span>
          </h2>
        </header>

        <TabelaAssociados linhas={linhas} />

        <div className="mt-4 space-y-2 border-t border-dashed border-borda pt-3">
          <Invariante codigo="I5">
            Ficha assinada é gate de envio: data, IP e hash do documento ficam gravados e são
            recuperáveis por associado. A exceção existe, mas é caminho explícito com justificativa
            em auditoria — nunca bypass silencioso.
          </Invariante>
          <Invariante codigo="I7">
            O telefone coletado na ficha é o que torna o bot de WhatsApp possível: a identidade do
            remetente é resolvida por ele, antes de qualquer ferramenta rodar.
          </Invariante>
        </div>
      </section>
    </div>
  )
}
