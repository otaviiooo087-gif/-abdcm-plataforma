import React, { useState } from 'react';
import { Registro, Lote } from '../../domain/types.js';
import { formatCurrencyBRL } from '../../lib/money/index.js';
import { Download, Search, Calendar, Eye, EyeOff, FileText } from 'lucide-react';

interface ListaEnviada {
  id: string;
  lote_id: string;
  nomes_count: number;
  valor_total: number;
  payment_status: string;
  submetido_em: string;
}

interface MinhasListasViewProps {
  registros: Registro[];
  lotes: Lote[];
  submissoes: ListaEnviada[];
}

const STATUS_LABEL: Record<string, { label: string; classes: string }> = {
  pendente: { label: 'Pendente de Pagamento', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  pago: { label: 'Aprovado', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  expirado: { label: 'Expirado', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  reprovado: { label: 'Cancelada por Falta de Pagamento', classes: 'bg-rose-50 text-rose-700 border-rose-200' },
  cancelado: { label: 'Cancelada', classes: 'bg-zinc-100 text-zinc-600 border-zinc-300' },
};

export const MinhasListasView: React.FC<MinhasListasViewProps> = ({ registros, lotes, submissoes }) => {
  const [search, setSearch] = useState('');
  const [selectedLote, setSelectedLote] = useState('todos');
  const [selectedStatus, setSelectedStatus] = useState('todos');
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loteDaSubmissao = (sub: ListaEnviada) => lotes.find((l) => l.id === sub.lote_id);

  // Filtros aplicados — nível da lista (submissão), não do nome individual
  const filtered = submissoes.filter((sub) => {
    const lote = loteDaSubmissao(sub);
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        (lote?.nome || '').toLowerCase().includes(q) ||
        (lote?.referencia_protocolo || '').toLowerCase().includes(q) ||
        (lote?.numero_processo || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (selectedLote !== 'todos' && sub.lote_id !== selectedLote) return false;
    if (selectedStatus !== 'todos' && sub.payment_status !== selectedStatus) return false;
    if (dataDe && new Date(sub.submetido_em) < new Date(dataDe)) return false;
    if (dataAte && new Date(sub.submetido_em) > new Date(`${dataAte}T23:59:59`)) return false;
    return true;
  });

  const ordenadas = [...filtered].sort(
    (a, b) => new Date(b.submetido_em).getTime() - new Date(a.submetido_em).getTime(),
  );

  const handleExportExcel = () => {
    const headers = [
      'Lista',
      'Numero_Protocolo',
      'Nome',
      'CPF_CNPJ',
      'Status',
      'Data_Envio',
    ];

    const rows = registros
      .filter((r) => (selectedLote === 'todos' ? true : r.lote_id === selectedLote))
      .map((r) => {
        const lote = lotes.find((l) => l.id === r.lote_id);
        return [
          `"${lote?.nome || 'AÇÃO COLETIVA'}"`,
          `"${lote?.referencia_protocolo || '—'}"`,
          `"${r.nome}"`,
          `"${r.cpf_cnpj}"`,
          `"${r.process_status.toUpperCase()}"`,
          `"${new Date(r.created_at).toLocaleDateString('pt-BR')}"`,
        ].join(',');
      });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `minhas_listas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statusBadge = (status: string) => {
    const config = STATUS_LABEL[status] ?? { label: status, classes: 'bg-slate-100 text-slate-600 border-slate-200' };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${config.classes}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="p-8 space-y-6 overflow-y-auto flex-1">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Minhas Listas</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Todas as listas enviadas, com o número do protocolo e os nomes anexados a cada uma
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportExcel}
          className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
        >
          <Download className="w-4 h-4 text-slate-500" />
          Exportar Excel
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por lista ou protocolo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none"
          />
        </div>

        <select
          value={selectedLote}
          onChange={(e) => setSelectedLote(e.target.value)}
          className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none text-slate-700 font-medium cursor-pointer"
        >
          <option value="todos">Todas as ações coletivas</option>
          {lotes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none text-slate-700 font-medium cursor-pointer"
        >
          <option value="todos">Todos os pagamentos</option>
          <option value="pendente">Pendente de Pagamento</option>
          <option value="pago">Aprovado</option>
          <option value="reprovado">Cancelada por Falta de Pagamento</option>
          <option value="expirado">Expirado</option>
        </select>

        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>De:</span>
          <input
            type="date"
            value={dataDe}
            onChange={(e) => setDataDe(e.target.value)}
            className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700"
          />
        </div>

        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>Até:</span>
          <input
            type="date"
            value={dataAte}
            onChange={(e) => setDataAte(e.target.value)}
            className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700"
          />
        </div>
      </div>

      <p className="text-xs text-slate-500">{ordenadas.length} lista(s) encontrada(s)</p>

      {/* Cards por lista (submissão) */}
      {ordenadas.length === 0 ? (
        <div className="bg-white p-10 rounded-xl border border-slate-200 shadow-2xs text-center text-xs text-slate-400">
          Nenhuma lista encontrada para os filtros aplicados.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ordenadas.map((sub) => {
            const lote = loteDaSubmissao(sub);
            const protocolo = lote?.referencia_protocolo || lote?.numero_processo || '—';
            const nomesDaLista = registros.filter((r) => r.submissao_id === sub.id);
            const isExpanded = expandedId === sub.id;
            const formattedDate = new Date(sub.submetido_em).toLocaleDateString('pt-BR');

            return (
              <div key={sub.id} className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{lote?.nome || 'Ação Coletiva'}</h4>
                    <p className="text-xs font-mono text-slate-500 mt-0.5 truncate">{protocolo}</p>
                  </div>
                  {statusBadge(sub.payment_status)}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Calendar className="w-3 h-3 shrink-0" />
                    <span className="truncate">{formattedDate}</span>
                  </span>
                  <span className="font-semibold text-slate-600 shrink-0">
                    {sub.nomes_count} nome(s) · {formatCurrencyBRL(sub.valor_total)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                  className="w-full pt-2.5 border-t border-slate-100 flex items-center justify-center gap-1.5 text-xs font-bold text-[#148296] hover:text-[#0f6b7c] cursor-pointer transition-colors"
                >
                  {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {isExpanded ? 'Ocultar nomes' : 'Ver nomes anexados'}
                </button>

                {isExpanded && (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto -mx-1 px-1">
                    {nomesDaLista.length === 0 ? (
                      <p className="text-[11px] text-slate-400 text-center py-3">
                        Nenhum nome encontrado nesta lista.
                      </p>
                    ) : (
                      nomesDaLista.map((reg) => (
                        <div
                          key={reg.id}
                          className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">{reg.nome}</p>
                            <p className="text-[10px] font-mono text-slate-500">{reg.cpf_cnpj}</p>
                          </div>
                          <span className="text-[9px] font-mono text-slate-400 shrink-0 flex items-center gap-1">
                            <FileText className="w-2.5 h-2.5" />
                            {reg.protocol_code || '—'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
