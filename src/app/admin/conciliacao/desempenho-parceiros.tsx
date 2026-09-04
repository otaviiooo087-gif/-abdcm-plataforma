import { formatarBRL } from '@/lib/money'

export type LinhaParceiro = {
  id: string
  nomeExibicao: string
  partnerCode: string
  cidadeUf: string
  totalNomesEnviados: number
  nomesPagos: number
  faturamentoPago: number
  precoPorNome: number
}

export function DesempenhoParceiros({ parceiros }: { parceiros: LinhaParceiro[] }) {
  if (parceiros.length === 0) {
    return (
      <div className="rounded-xl border border-borda bg-white p-8 text-center text-xs text-slate-400">
        Nenhum parceiro com envio registrado neste tenant ainda.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-borda bg-white">
      <div className="border-b border-borda p-4">
        <h4 className="text-sm font-semibold text-marinho">Parceiros cadastrados</h4>
        <p className="text-xs text-slate-500">Volume enviado, nomes já pagos e faturamento confirmado por parceiro.</p>
      </div>
      <table className="w-full text-left text-xs">
        <thead className="border-b border-borda bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2.5">Parceiro</th>
            <th className="px-4 py-2.5">Código</th>
            <th className="px-4 py-2.5">Preço por nome</th>
            <th className="px-4 py-2.5">Total de nomes enviados</th>
            <th className="px-4 py-2.5">Nomes pagos</th>
            <th className="px-4 py-2.5">Faturamento confirmado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-borda">
          {parceiros.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-semibold text-marinho">{p.nomeExibicao}</p>
                <span className="text-[11px] text-slate-400">{p.cidadeUf}</span>
              </td>
              <td className="px-4 py-3 font-mono text-slate-600">{p.partnerCode}</td>
              <td className="px-4 py-3 tabular-nums text-slate-700">{formatarBRL(p.precoPorNome)}</td>
              <td className="px-4 py-3 font-semibold text-slate-800">{p.totalNomesEnviados}</td>
              <td className="px-4 py-3 text-slate-700">{p.nomesPagos}</td>
              <td className="px-4 py-3 font-semibold tabular-nums text-emerald-700">{formatarBRL(p.faturamentoPago)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
