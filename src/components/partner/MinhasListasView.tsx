import React, { useState } from 'react';
import { Registro, Lote } from '../../domain/types.js';
import { Download, Search, Calendar } from 'lucide-react';

interface MinhasListasViewProps {
  registros: Registro[];
  lotes: Lote[];
}

export const MinhasListasView: React.FC<MinhasListasViewProps> = ({ registros, lotes }) => {
  const [search, setSearch] = useState('');
  const [selectedLote, setSelectedLote] = useState('todos');
  const [selectedStatus, setSelectedStatus] = useState('todos');
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');

  // Filtros aplicados
  const filtered = registros.filter((reg) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        reg.nome.toLowerCase().includes(q) ||
        reg.cpf_cnpj.toLowerCase().includes(q) ||
        (reg.protocol_code && reg.protocol_code.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (selectedLote !== 'todos' && reg.lote_id !== selectedLote) {
      return false;
    }
    if (selectedStatus !== 'todos') {
      if (selectedStatus === 'enviado' && reg.process_status !== 'enviado' && reg.process_status !== 'pago') return false;
      if (selectedStatus === 'pendente' && reg.process_status !== 'pendente') return false;
      if (selectedStatus === 'baixado' && reg.process_status !== 'baixado') return false;
    }
    return true;
  });

  const handleExportExcel = () => {
    const headers = [
      'Lista',
      'Numero_Acao_Coletiva',
      'Observacao',
      'Nome',
      'CPF_CNPJ',
      'Tipo',
      'Status',
      'Serasa',
      'Boa_Vista',
      'SPC',
      'Cenprot_BR',
      'Cenprot_SP',
      'Data',
    ];

    const rows = filtered.map((r) => {
      const lote = lotes.find((l) => l.id === r.lote_id);
      const isBaixado = r.process_status === 'baixado';
      const bureauStatus = isBaixado ? 'baixado' : 'pendente';
      return [
        `"${lote?.nome || 'AÇÃO COLETIVA 124'}"`,
        `"${lote?.referencia_protocolo || '2026.888.10124'}"`,
        '"—"',
        `"${r.nome}"`,
        `"${r.cpf_cnpj}"`,
        `"${r.tipo_documento.toUpperCase()}"`,
        `"${r.process_status.toUpperCase()}"`,
        `"${bureauStatus}"`,
        `"${bureauStatus}"`,
        `"${bureauStatus}"`,
        `"${bureauStatus}"`,
        `"${bureauStatus}"`,
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

  const getStatusPill = (status: string) => {
    if (status === 'enviado' || status === 'pago' || status === 'protocolado') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]">
          Enviado
        </span>
      );
    }
    if (status === 'baixado') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Baixado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
        Pendente
      </span>
    );
  };

  const getBureauPill = (status: string) => {
    if (status === 'baixado') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
          baixado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase">
        pendente
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
            Histórico completo de todos os nomes cadastrados
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
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar nome ou CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none"
          />
        </div>

        {/* List Filter */}
        <select
          value={selectedLote}
          onChange={(e) => setSelectedLote(e.target.value)}
          className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none text-slate-700 font-medium cursor-pointer"
        >
          <option value="todos">Todas as listas</option>
          {lotes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none text-slate-700 font-medium cursor-pointer"
        >
          <option value="todos">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="enviado">Enviado</option>
          <option value="baixado">Baixado</option>
        </select>

        {/* Date From */}
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

        {/* Date To */}
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

      {/* Contador */}
      <p className="text-xs text-slate-500">{filtered.length} nome(s) encontrado(s)</p>

      {/* Cards individuais */}
      {filtered.length === 0 ? (
        <div className="bg-white p-10 rounded-xl border border-slate-200 shadow-2xs text-center text-xs text-slate-400">
          Nenhum registro encontrado para os filtros aplicados.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((reg) => {
            const lote = lotes.find((l) => l.id === reg.lote_id);
            const bureauState = reg.process_status === 'baixado' ? 'baixado' : 'pendente';
            const formattedDate = new Date(reg.created_at).toLocaleDateString('pt-BR');

            return (
              <div
                key={reg.id}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{reg.nome}</h4>
                    <p className="text-xs font-mono text-slate-500 mt-0.5">{reg.cpf_cnpj}</p>
                  </div>
                  {getStatusPill(reg.process_status)}
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 min-w-0">
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span className="truncate">{lote?.nome || 'AÇÃO COLETIVA 124'}</span>
                </div>

                <div className="pt-2.5 border-t border-slate-100 grid grid-cols-5 gap-1 text-center">
                  {['Serasa', 'Boa Vista', 'SPC', 'Cenprot BR', 'Cenprot SP'].map((label) => (
                    <div key={label} className="flex flex-col items-center gap-1">
                      {getBureauPill(bureauState)}
                      <span className="text-[8px] text-slate-400 leading-tight">{label}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-1 flex items-center justify-between">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                    {reg.tipo_documento.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">{formattedDate}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
