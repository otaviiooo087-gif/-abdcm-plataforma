import React, { useState } from 'react';
import { StatusBadge } from './StatusBadge.js';
import { Search, ShieldCheck, Clock, FileCheck, ArrowRight } from 'lucide-react';

interface PublicResult {
  id: string;
  nome: string;
  cpf_cnpj_mascarado: string;
  protocol_code: string;
  lote_nome: string;
  process_status: string;
  enviado_em?: string;
  protocolado_em?: string;
  baixado_em?: string;
  timeline: Array<{
    de_status: string | null;
    para_status: string;
    motivo: string;
    ocorrido_em: string;
  }>;
}

export const ConsultaPublica: React.FC = () => {
  const [docInput, setDocInput] = useState('');
  const [protInput, setProtInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PublicResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docInput.trim() && !protInput.trim()) {
      setError('Informe o seu CPF/CNPJ ou o Número de Protocolo da sua Ação Coletiva.');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch('/api/consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpf_cnpj: docInput.trim(),
          protocol_code: protInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nenhum registro localizado.');
      }
      setResults(data.results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro na consulta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto space-y-8 overflow-y-auto flex-1">
      {/* Title & Explainer */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#106778]/10 text-[#106778] border border-[#106778]/20 shadow-2xs mb-1">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Acompanhamento de Ação Coletiva
        </h2>
        <p className="text-xs text-slate-500 max-w-lg mx-auto">
          Consulte o andamento da sua solicitação protocolada pela ABDCM perante os órgãos de proteção ao crédito (Serasa, SPC, Boa Vista, Cenprot).
        </p>
      </div>

      {/* Search Card in Professional Polish Style */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                CPF ou CNPJ do Associado
              </label>
              <input
                type="text"
                value={docInput}
                onChange={(e) => setDocInput(e.target.value)}
                placeholder="Ex: 542.891.740-92"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#106778] focus:border-[#106778] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Número do Protocolo (Opcional)
              </label>
              <input
                type="text"
                value={protInput}
                onChange={(e) => setProtInput(e.target.value)}
                placeholder="Ex: ABDCM-AC124-001-ACP"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#106778] focus:border-[#106778] outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-400">
              * Consulta pública segura sem necessidade de login.
            </span>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#106778] hover:bg-[#0c4f5d] shadow-2xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Search className="w-3.5 h-3.5" />
              {loading ? 'Consultando...' : 'Consultar Processo'}
            </button>
          </div>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 text-center font-medium shadow-2xs">
          {error}
        </div>
      )}

      {/* Results */}
      {results && results.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Processos Localizados ({results.length})
          </h3>

          {results.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden"
            >
              {/* Card Header */}
              <div className="p-5 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {item.lote_nome}
                  </span>
                  <h4 className="text-base font-bold text-slate-900">{item.nome}</h4>
                  <p className="text-xs text-slate-500 font-mono">
                    Documento: {item.cpf_cnpj_mascarado} • Protocolo:{' '}
                    <strong className="text-slate-800">{item.protocol_code}</strong>
                  </p>
                </div>
                <StatusBadge status={item.process_status} />
              </div>

              {/* Timeline */}
              <div className="p-6 space-y-4">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#106778]" /> Linha do Tempo do Processo
                </p>

                {item.timeline.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhum evento registrado ainda.</p>
                ) : (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {item.timeline.map((ev, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#106778] border-2 border-white shadow-xs"></div>
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
                          <div className="flex items-center justify-between mb-1">
                            <StatusBadge status={ev.para_status} />
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(ev.ocorrido_em).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 font-medium">{ev.motivo}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
