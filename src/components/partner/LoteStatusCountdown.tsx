import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Radio, Scale, PartyPopper, Ban } from 'lucide-react';
import { Lote } from '../../domain/types.js';

interface LoteStatusCountdownProps {
  lote?: Lote;
}

interface Restante {
  dias: number;
  horas: number;
  minutos: number;
  segundos: number;
  vencido: boolean;
}

function useContagemRegressiva(alvoIso?: string | null): Restante | null {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (!alvoIso) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [alvoIso]);

  if (!alvoIso) return null;
  const diff = Math.max(0, new Date(alvoIso).getTime() - agora);
  return {
    dias: Math.floor(diff / 86_400_000),
    horas: Math.floor((diff % 86_400_000) / 3_600_000),
    minutos: Math.floor((diff % 3_600_000) / 60_000),
    segundos: Math.floor((diff % 60_000) / 1_000),
    vencido: diff <= 0,
  };
}

// "Falta X dia(s)" / "Falta X hora(s)" / "Falta X minuto(s)" — sempre a
// maior unidade não-zero, pra não ficar mostrando "0 dias, 0 horas, 3 min".
function faltaResumo(r: Restante): string {
  if (r.vencido) return 'a qualquer momento';
  if (r.dias > 0) return `${r.dias} dia${r.dias === 1 ? '' : 's'}`;
  if (r.horas > 0) return `${r.horas} hora${r.horas === 1 ? '' : 's'}`;
  return `${r.minutos} minuto${r.minutos === 1 ? '' : 's'}`;
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

const digitos = (r: Restante) => [
  { valor: r.dias, label: 'DIAS' },
  { valor: r.horas, label: 'HRS' },
  { valor: r.minutos, label: 'MIN' },
  { valor: r.segundos, label: 'SEG' },
];

const RelogioDigital: React.FC<{ restante: Restante; tom: string }> = ({ restante, tom }) => (
  <div className="flex items-center gap-1">
    {digitos(restante).map((d) => (
      <div key={d.label} className={`px-1.5 py-0.5 rounded-md text-center min-w-[30px] ${tom}`}>
        <span className="block text-xs font-black tabular-nums leading-none">{String(d.valor).padStart(2, '0')}</span>
        <span className="block text-[7px] font-bold leading-none mt-0.5 opacity-70">{d.label}</span>
      </div>
    ))}
  </div>
);

// Cronômetro por card, dirigido pelo status real do lote (rascunho -> aberto
// -> encerrado -> em_protocolo/protocolado -> concluido). Cada status tem sua
// própria contagem: falta pra abrir, falta pra encerrar, ou nenhuma.
export const LoteStatusCountdown: React.FC<LoteStatusCountdownProps> = ({ lote }) => {
  const contagemAbertura = useContagemRegressiva(lote?.status === 'rascunho' ? lote.abre_em : null);
  const contagemEncerramento = useContagemRegressiva(lote?.status === 'aberto' ? lote.closes_at : null);

  if (!lote) return null;

  if (lote.status === 'rascunho' && contagemAbertura) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
          <Lock className="w-3 h-3 shrink-0" />
          Abre em {formatarDataHora(lote.abre_em)}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-500">
            Falta <strong className="text-slate-700">{faltaResumo(contagemAbertura)}</strong> pra abertura de {lote.nome}
          </span>
          <RelogioDigital restante={contagemAbertura} tom="bg-white text-slate-700 border border-slate-200" />
        </div>
      </div>
    );
  }

  if (lote.status === 'aberto' && contagemEncerramento) {
    return (
      <motion.div
        animate={{ boxShadow: ['0 0 0px rgba(20,130,150,0)', '0 0 12px rgba(20,130,150,0.35)', '0 0 0px rgba(20,130,150,0)'] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="rounded-lg border border-[#148296]/30 bg-gradient-to-r from-[#148296]/10 to-emerald-50 px-2.5 py-2 space-y-1.5"
      >
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0f6b7c]">
          <motion.span
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
          />
          <Radio className="w-3 h-3 shrink-0" />
          Lista Aberta — capte agora!
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-600">
            Encerra em <strong className="text-[#0f6b7c]">{faltaResumo(contagemEncerramento)}</strong>
          </span>
          <RelogioDigital restante={contagemEncerramento} tom="bg-[#148296] text-white" />
        </div>
      </motion.div>
    );
  }

  if (lote.status === 'encerrado') {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-bold text-slate-500">
        <Ban className="w-3 h-3 shrink-0" />
        Lista Fechada — aguardando envio ao protocolo
      </div>
    );
  }

  if (lote.status === 'em_protocolo' || lote.status === 'protocolado') {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-[11px] font-bold text-blue-700">
        <Scale className="w-3 h-3 shrink-0" />
        Protocolada no Processo — aguardando baixas dos órgãos
      </div>
    );
  }

  if (lote.status === 'concluido') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-gradient-to-r from-emerald-50 via-amber-50 to-emerald-50 px-2.5 py-2 text-[11px] font-bold text-emerald-700"
      >
        <motion.span animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 1.4, repeat: Infinity }}>
          <PartyPopper className="w-3.5 h-3.5 shrink-0" />
        </motion.span>
        Ação Coletiva Concluída!
      </motion.div>
    );
  }

  return null;
};
