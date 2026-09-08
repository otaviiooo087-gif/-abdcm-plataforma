import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Registro, ProcessStatus } from '../domain/types.js';
import { CheckCircle2, X } from 'lucide-react';

interface ProcessoToastsProps {
  registros: Registro[];
  parceiroId?: string;
}

interface ToastItem {
  id: string;
  nome: string;
  mensagem: string;
}

const STATUS_LABEL: Partial<Record<ProcessStatus, string>> = {
  pago: 'pagamento confirmado',
  aguardando_protocolo: 'em preparação para protocolo',
  protocolado: 'protocolado junto aos birôs',
  baixado: 'baixado — nome limpo!',
  recusado: 'recusado pelo birô',
  aguardando_pagamento: 'aguardando confirmação de pagamento',
  reprovado: 'pagamento reprovado',
};

/** Toasts não-bloqueantes toda vez que um registro do parceiro muda de
 * status — compara o snapshot atual com o anterior a cada atualização de
 * `registros` (a mesma lista que o App já recarrega após cada ação e
 * periodicamente). Primeira carga não dispara nada (não é "mudança"). */
export const ProcessoToasts: React.FC<ProcessoToastsProps> = ({ registros, parceiroId }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const statusAnteriorRef = useRef<Map<string, ProcessStatus> | null>(null);

  useEffect(() => {
    const meusRegistros = parceiroId ? registros.filter((r) => r.parceiro_id === parceiroId) : registros;
    const atual = new Map(meusRegistros.map((r) => [r.id, r.process_status]));

    if (statusAnteriorRef.current) {
      const anterior = statusAnteriorRef.current;
      const novosToasts: ToastItem[] = [];
      for (const r of meusRegistros) {
        const de = anterior.get(r.id);
        if (de && de !== r.process_status && STATUS_LABEL[r.process_status]) {
          novosToasts.push({
            id: `${r.id}-${r.process_status}-${Date.now()}`,
            nome: r.nome,
            mensagem: STATUS_LABEL[r.process_status]!,
          });
        }
      }
      if (novosToasts.length > 0) {
        setToasts((prev) => [...novosToasts, ...prev].slice(0, 4));
        novosToasts.forEach((t) => {
          setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 6000);
        });
      }
    }

    statusAnteriorRef.current = atual;
  }, [registros, parceiroId]);

  return (
    <div className="fixed bottom-6 left-6 z-[70] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="pointer-events-auto bg-white border border-slate-200 shadow-lg rounded-xl px-4 py-3 flex items-start gap-2.5 max-w-xs"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{t.nome}</p>
              <p className="text-[11px] text-slate-500">{t.mensagem}</p>
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-slate-300 hover:text-slate-600 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
