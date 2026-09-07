import React from 'react';
import { CheckCircle2, ArrowRight, X } from 'lucide-react';

interface PagamentoConfirmadoModalProps {
  isOpen: boolean;
  nomesCount?: number;
  onClose: () => void;
  onVerMinhasListas: () => void;
}

export const PagamentoConfirmadoModal: React.FC<PagamentoConfirmadoModalProps> = ({
  isOpen,
  nomesCount,
  onClose,
  onVerMinhasListas,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="relative bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl overflow-hidden animate-abdcm-modal-pop">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center animate-abdcm-check-pop">
            <CheckCircle2 className="w-9 h-9 text-emerald-600" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-black text-slate-900">Pagamento aprovado! 🎉</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {nomesCount ? `Seus ${nomesCount} nome(s) foram incluídos` : 'Seus nomes foram incluídos'} na
              nossa lista. Acompanhe o status na aba <strong className="text-slate-700">Minhas Listas</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={onVerMinhasListas}
            className="w-full px-4 py-2.5 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            Ver Minhas Listas
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
