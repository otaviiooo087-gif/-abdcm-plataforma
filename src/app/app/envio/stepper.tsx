import { IconCheckSquare, IconClipboard, IconCreditCard, IconSend } from '@/components/icons'

const ETAPAS = [
  { n: 1, nome: 'Cadastre os nomes', Icone: IconClipboard },
  { n: 2, nome: 'Selecione na tabela', Icone: IconCheckSquare },
  { n: 3, nome: 'Envie a lista', Icone: IconSend },
  { n: 4, nome: 'Pague via PIX', Icone: IconCreditCard },
] as const

/** Progresso do fluxo de envio. Etapa atual é sempre "Selecione na tabela": é o que esta página faz. */
export function StepperEnvio({ atual = 2 }: { atual?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl border border-borda bg-white p-4 sm:grid-cols-4">
      {ETAPAS.map(({ n, nome, Icone }) => {
        const feito = n < atual
        const ativo = n === atual
        return (
          <div
            key={n}
            className={`flex flex-col items-center gap-2 rounded-lg py-3 text-center ${
              ativo ? 'bg-azul-claro ring-1 ring-inset ring-azul/25' : ''
            }`}
          >
            <span
              className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold ${
                ativo ? 'bg-azul text-white' : feito ? 'bg-verde text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {n}
            </span>
            <Icone className={`h-[18px] w-[18px] ${ativo ? 'text-azul' : feito ? 'text-verde' : 'text-slate-300'}`} />
            <p className={`text-xs font-medium leading-tight ${ativo || feito ? 'text-marinho' : 'text-slate-400'}`}>
              {nome}
            </p>
          </div>
        )
      })}
    </div>
  )
}
