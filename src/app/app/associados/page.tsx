import { Invariante, Secao } from '@/components/ui'
import { exigirSessao } from '@/lib/sessao-guard'
import { formatarDocumento } from '@/lib/documento'
import { banco, doTenant } from '@/store/repo'

const ROTULO: Record<string, { texto: string; cor: string }> = {
  pre_cadastro: { texto: 'pré-cadastro', cor: 'text-slate-500' },
  ficha_enviada: { texto: 'ficha enviada, aguardando assinatura', cor: 'text-ambar' },
  ficha_assinada: { texto: 'ficha assinada', cor: 'text-verde' },
  ativo: { texto: 'ativo', cor: 'text-verde' },
  inativo: { texto: 'inativo', cor: 'text-slate-400' },
}

export default async function Associados() {
  const sessao = await exigirSessao('portal.parceiro')
  const db = banco()

  const associados = doTenant(db.associados, sessao.tenantId).filter(
    (a) => a.parceiroId === sessao.parceiroId,
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-marinho">Associados</h1>
        <p className="mt-1 text-sm text-slate-600">
          O cliente não compra um serviço: ele se filia à ABDCM. A ficha associativa é, ao mesmo
          tempo, o instrumento de filiação e o consentimento LGPD para tratamento do CPF.
        </p>
      </div>

      <Secao titulo={`${associados.length} associados sob o seu código`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="pb-2 pr-3">Nome</th>
                <th className="pb-2 pr-3">Documento</th>
                <th className="pb-2 pr-3">WhatsApp</th>
                <th className="pb-2 pr-3">Filiação</th>
                <th className="pb-2 pr-3">Consentimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {associados.map((a) => {
                const r = ROTULO[a.statusFiliacao]!
                return (
                  <tr key={a.id}>
                    <td className="py-2 pr-3 font-medium text-marinho">{a.nome}</td>
                    {/* No portal, o parceiro vê o documento de quem ele mesmo filiou. */}
                    <td className="py-2 pr-3 font-mono text-xs">{formatarDocumento(a.cpfCnpj)}</td>
                    <td className="py-2 pr-3 text-xs text-slate-600">{a.telefoneWhatsapp}</td>
                    <td className={`py-2 pr-3 text-xs font-medium ${r.cor}`}>{r.texto}</td>
                    <td className="py-2 pr-3 text-xs text-slate-500">
                      {a.consentimentoEm
                        ? <>{a.consentimentoEm.toLocaleDateString('pt-BR')} · IP {a.consentimentoIp}</>
                        : <span className="text-ambar">pendente</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Invariante codigo="I5">
          Ficha assinada é gate de envio: data, IP e hash do documento ficam gravados e são
          recuperáveis por associado. A exceção existe, mas é caminho explícito com justificativa
          em auditoria — nunca bypass silencioso.
        </Invariante>
        <Invariante codigo="I7">
          O telefone coletado na ficha é o que torna o bot de WhatsApp possível: a identidade do
          remetente é resolvida por ele, antes de qualquer ferramenta rodar.
        </Invariante>
      </Secao>
    </div>
  )
}
