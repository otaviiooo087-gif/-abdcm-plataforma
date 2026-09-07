import React from 'react';
import { Lote, Registro, Submissao } from '../../domain/types.js';
import { formatCurrencyBRL } from '../../lib/money/index.js';
import { TrendingUp, Clock, Layers, CheckCircle2, AlertTriangle } from 'lucide-react';

interface AdminDashboardTabProps {
  lotes: Lote[];
  registros: Registro[];
  submissoes: Submissao[];
}

export const AdminDashboardTab: React.FC<AdminDashboardTabProps> = ({ lotes, registros, submissoes }) => {
  const faturamentoConfirmado = submissoes
    .filter((s) => s.payment_status === 'pago')
    .reduce((acc, s) => acc + s.valor_total, 0);
  const faturamentoPendente = submissoes
    .filter((s) => s.payment_status === 'pendente')
    .reduce((acc, s) => acc + s.valor_total, 0);

  const lotesAbertos = lotes.filter((l) => l.status === 'aberto').length;
  const totalRegistros = registros.length;
  const baixados = registros.filter((r) => r.process_status === 'baixado').length;
  const pendenciasConciliacao = submissoes.filter((s) => s.payment_status === 'pendente').length;

  const ultimosLotes = [...lotes]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const statusPill = (status: Lote['status']) => {
    const map: Record<Lote['status'], string> = {
      rascunho: 'bg-slate-100 text-slate-600 border-slate-200',
      aberto: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      encerrado: 'bg-amber-50 text-amber-800 border-amber-200',
      em_protocolo: 'bg-sky-50 text-sky-700 border-sky-200',
      protocolado: 'bg-blue-50 text-blue-700 border-blue-200',
      concluido: 'bg-slate-100 text-slate-700 border-slate-200',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border capitalize ${map[status]}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Dashboard</h2>
        <p className="text-xs text-slate-500 mt-0.5">Resumo geral da operação e do faturamento</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Faturamento Confirmado
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrencyBRL(faturamentoConfirmado)}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Faturamento Pendente
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 mt-1">{formatCurrencyBRL(faturamentoPendente)}</p>
          <p className="text-[11px] text-slate-500 mt-1">{pendenciasConciliacao} aguardando conciliação</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Ações Coletivas Abertas
            </span>
            <Layers className="w-4 h-4 text-[#148296]" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1">{lotesAbertos}</p>
          <p className="text-[11px] text-slate-500 mt-1">de {lotes.length} no total</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Nomes Baixados
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1">{baixados}</p>
          <p className="text-[11px] text-slate-500 mt-1">de {totalRegistros} associados na base</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Ações Coletivas Recentes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Lote</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Encerra</th>
                <th className="px-6 py-3">Associados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {ultimosLotes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                    Nenhuma Ação Coletiva cadastrada ainda.
                  </td>
                </tr>
              ) : (
                ultimosLotes.map((lote) => (
                  <tr key={lote.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-3 font-bold text-slate-900">{lote.nome}</td>
                    <td className="px-6 py-3">{statusPill(lote.status)}</td>
                    <td className="px-6 py-3 font-mono text-slate-500">
                      {new Date(lote.closes_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-3">{registros.filter((r) => r.lote_id === lote.id).length}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pendenciasConciliacao > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-900">
            <strong>{pendenciasConciliacao}</strong> submissão(ões) aguardando conciliação financeira —
            veja a aba <strong>Financeiro</strong>.
          </p>
        </div>
      )}
    </div>
  );
};
