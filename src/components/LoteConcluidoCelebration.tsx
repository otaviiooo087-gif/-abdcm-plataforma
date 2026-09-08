import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lote, Registro } from '../domain/types.js';
import { PartyPopper, BadgeCheck, X } from 'lucide-react';

interface LoteConcluidoCelebrationProps {
  lotes: Lote[];
  registros: Registro[];
  parceiroId?: string;
  onEmitirNadaConsta: () => void;
}

const STORAGE_KEY = 'abdcm_lotes_comemorados';

function lotesJaComemorados(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function marcarComemorado(loteId: string) {
  const atuais = lotesJaComemorados();
  atuais.add(loteId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...atuais]));
  } catch {
    // localStorage indisponível não deve travar a experiência
  }
}

const CORES_CONFETE = ['#148296', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

export const LoteConcluidoCelebration: React.FC<LoteConcluidoCelebrationProps> = ({
  lotes,
  registros,
  parceiroId,
  onEmitirNadaConsta,
}) => {
  const [loteParaComemorar, setLoteParaComemorar] = useState<Lote | null>(null);

  useEffect(() => {
    if (!parceiroId) return;
    const jaVistos = lotesJaComemorados();
    const candidato = lotes.find(
      (l) =>
        l.status === 'concluido' &&
        !jaVistos.has(l.id) &&
        registros.some((r) => r.lote_id === l.id && r.parceiro_id === parceiroId),
    );
    if (candidato) setLoteParaComemorar(candidato);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotes, parceiroId]);

  const handleFechar = () => {
    if (loteParaComemorar) marcarComemorado(loteParaComemorar.id);
    setLoteParaComemorar(null);
  };

  const handleEmitir = () => {
    if (loteParaComemorar) marcarComemorado(loteParaComemorar.id);
    setLoteParaComemorar(null);
    onEmitirNadaConsta();
  };

  return (
    <AnimatePresence>
      {loteParaComemorar && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 18 }}
            className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center overflow-hidden"
          >
            {/* Confete */}
            {Array.from({ length: 24 }).map((_, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 1, y: -20, x: 0, rotate: 0 }}
                animate={{ opacity: 0, y: 260, x: (Math.random() - 0.5) * 280, rotate: Math.random() * 360 }}
                transition={{ duration: 2 + Math.random(), ease: 'easeIn', delay: Math.random() * 0.3 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: `${10 + Math.random() * 80}%`,
                  width: 8,
                  height: 8,
                  borderRadius: Math.random() > 0.5 ? '50%' : 2,
                  background: CORES_CONFETE[i % CORES_CONFETE.length],
                }}
              />
            ))}

            <button
              type="button"
              onClick={handleFechar}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 1, delay: 0.3 }}
              className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4"
            >
              <PartyPopper className="w-8 h-8" />
            </motion.div>

            <h3 className="text-lg font-black text-slate-900">Oba! 🎉</h3>
            <p className="text-sm text-slate-700 mt-1.5 leading-relaxed">
              A <strong>{loteParaComemorar.nome}</strong> — Limpa Nome foi concluída com sucesso!
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Faça a emissão dos seus nada consta agora — a certidão já está disponível pra cada
              nome que teve baixa em todos os órgãos.
            </p>

            <button
              type="button"
              onClick={handleEmitir}
              className="mt-6 w-full px-4 py-3 rounded-xl bg-[#148296] hover:bg-[#0f6b7c] text-white text-sm font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <BadgeCheck className="w-4 h-4" />
              Emitir meus Nada Consta
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
