import React, { useState } from 'react';
import { X, Send, AlertTriangle } from 'lucide-react';

interface EnviarListaModalProps {
  isOpen: boolean;
  onClose: () => void;
  count: number;
  totalValueFormatted: string;
  onConfirm: () => Promise<void>;
}

export const EnviarListaModal: React.FC<EnviarListaModalProps> = ({
  isOpen,
  onClose,
  count,
  totalValueFormatted,
  onConfirm,
}) => {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#148296]/10 text-[#148296] flex items-center justify-center font-bold">
              <Send className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Enviar Lista</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 text-center space-y-4">
          <p className="text-sm text-slate-600">
            Você está enviando <strong className="text-slate-900 font-bold">{count} nomes</strong> para processamento.
          </p>

          <div className="py-3 px-4 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold block mb-1">
              Valor Total do Envio
            </span>
            <span className="text-3xl font-black text-slate-900 tracking-tight block">
              {totalValueFormatted}
            </span>
          </div>

          <div className="flex items-center gap-2 text-left bg-amber-50 text-amber-800 p-3 rounded-xl border border-amber-200/80 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Após o envio, os nomes serão bloqueados para edição.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleConfirm}
            className="px-5 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-sm cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Confirmar Envio'}
          </button>
        </div>
      </div>
    </div>
  );
};
