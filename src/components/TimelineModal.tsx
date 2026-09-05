import React, { useEffect, useState } from 'react';
import { ProcessEvent, Registro } from '../domain/types.js';
import { StatusBadge } from './StatusBadge.js';
import { X, History, Clock, ArrowRight, ShieldCheck } from 'lucide-react';

interface TimelineModalProps {
  registro: Registro | null;
  onClose: () => void;
}

export const TimelineModal: React.FC<TimelineModalProps> = ({ registro, onClose }) => {
  const [events, setEvents] = useState<ProcessEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!registro) return;
    setLoading(true);
    fetch(`/api/registros/${registro.id}/timeline`)
      .then((res) => res.json())
      .then((data) => {
        setEvents(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [registro]);

  if (!registro) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#106778]/10 text-[#106778] flex items-center justify-center border border-[#106778]/20">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Histórico de Eventos do Processo</h3>
              <p className="text-[11px] text-slate-500 font-mono">
                ID: {registro.id} • Protocolo: {registro.protocol_code || 'Pendente'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Associado Info Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500 font-medium">Associado: </span>
            <span className="font-semibold text-slate-800">{registro.nome}</span>
            <span className="ml-2 text-slate-400 font-mono">({registro.cpf_cnpj})</span>
          </div>
          <div>
            <span className="text-slate-500 font-medium mr-2">Status Atual:</span>
            <StatusBadge status={registro.process_status} />
          </div>
        </div>

        {/* Timeline Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium pb-2 border-b border-slate-100">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Trilha de Auditoria Imutável (ProcessEvents — Regra I2)</span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Carregando eventos...</div>
          ) : events.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Nenhum evento registrado até o momento.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {events.map((ev) => (
                <div key={ev.id} className="relative group">
                  <div className="absolute -left-[19px] top-1 w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow-xs"></div>
                  <div className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg p-3.5 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {ev.de_status && (
                          <>
                            <StatusBadge status={ev.de_status} />
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                          </>
                        )}
                        <StatusBadge status={ev.para_status} />
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {new Date(ev.ocorrido_em).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 font-medium mt-1">{ev.motivo}</p>
                    <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400">
                      <span>
                        Ator: <strong className="text-slate-600">{ev.ator_tipo}</strong> ({ev.ator_user_id})
                      </span>
                      <span className="font-mono">{ev.id}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors shadow-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
