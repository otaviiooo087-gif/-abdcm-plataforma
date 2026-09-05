import React, { useState } from 'react';
import { Registro, ProcessStatus } from '../domain/types.js';
import { VALID_TRANSITIONS } from '../domain/registros/stateMachine.js';
import { StatusBadge } from './StatusBadge.js';
import { AlertTriangle, X, CheckCircle2 } from 'lucide-react';

interface TransitionModalProps {
  registro: Registro | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const TransitionModal: React.FC<TransitionModalProps> = ({
  registro,
  onClose,
  onSuccess,
}) => {
  if (!registro) return null;

  const validNext = VALID_TRANSITIONS[registro.process_status] || [];
  const [selectedStatus, setSelectedStatus] = useState<ProcessStatus | ''>(validNext[0] || '');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatus) {
      setError('Selecione um status de destino válido.');
      return;
    }
    if (!motivo || motivo.trim().length < 5) {
      setError('O motivo é obrigatório e deve ter ao menos 5 caracteres (Regra I11).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/registros/${registro.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paraStatus: selectedStatus,
          motivo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao transitar status.');
      }

      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao processar transição.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#106778]/10 text-[#106778] flex items-center justify-center border border-[#106778]/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Transição de Status de Processo</h3>
              <p className="text-[11px] text-slate-500">Validação estrita no servidor com gravação de ProcessEvent</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Registro Selecionado</span>
              <span className="font-semibold text-slate-800">{registro.nome}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold text-right mb-1">Status Atual</span>
              <StatusBadge status={registro.process_status} />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Próximo Status Válido pela Máquina de Estados
            </label>
            {validNext.length === 0 ? (
              <p className="text-xs text-amber-600 font-medium">Este registro está em estado terminal e não permite transições.</p>
            ) : (
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as ProcessStatus)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {validNext.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Motivo da Transição (Obrigatório — I2 & I11)
            </label>
            <textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva a justificativa formal para a alteração deste status..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || validNext.length === 0}
              className="px-4 py-2 text-xs font-bold text-white bg-[#106778] rounded-lg hover:bg-[#0c4f5d] disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {loading ? 'Processando...' : 'Confirmar Transição'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
