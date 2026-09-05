import React, { useState, useMemo } from 'react';
import { Lote, Registro } from '../../domain/types.js';
import { StatusBadge } from '../StatusBadge.js';
import { formatCurrencyBRL } from '../../lib/money/index.js';
import { UserSession } from '../../server/mockData.js';
import {
  Layers,
  Search,
  Copy,
  Check,
  CheckCircle,
  FileSpreadsheet,
  Download,
  ArrowRightLeft,
  Eye,
  Lock,
  Clock,
  Building2,
  FileText,
  Filter,
  CheckSquare,
  AlertCircle,
  Gavel,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface AdminProcessosTabProps {
  lotes: Lote[];
  registros: Registro[];
  session: UserSession | null;
  unmaskedDocs: Record<string, string>;
  onRevealDocument: (regId: string) => void;
  onOpenTimeline: (reg: Registro) => void;
  onOpenTransition: (reg: Registro) => void;
  onRefreshData: () => void;
}

export const AdminProcessosTab: React.FC<AdminProcessosTabProps> = ({
  lotes,
  registros,
  session,
  unmaskedDocs,
  onRevealDocument,
  onOpenTimeline,
  onOpenTransition,
  onRefreshData,
}) => {
  // Lote selecionado (padrão: lote mais recente ou todos)
  const [selectedLoteId, setSelectedLoteId] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [copiedProcesso, setCopiedProcesso] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchTargetStatus, setBatchTargetStatus] = useState<string>('protocolado');
  const [batchMotivo, setBatchMotivo] = useState('');
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [showAndamentoModal, setShowAndamentoModal] = useState(false);
  const [andamentoTexto, setAndamentoTexto] = useState('');

  const handleCopyProcesso = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedProcesso(num);
    setTimeout(() => setCopiedProcesso(null), 2500);
  };

  // Lote atualmente selecionado (se não for 'todos')
  const currentLote = useMemo(() => {
    if (selectedLoteId === 'todos') return null;
    return lotes.find((l) => l.id === selectedLoteId) || null;
  }, [lotes, selectedLoteId]);

  // Registros filtrados pelo lote selecionado, busca e status
  const filteredRegistros = useMemo(() => {
    return registros.filter((reg) => {
      // Filtro por Lote
      if (selectedLoteId !== 'todos' && reg.lote_id !== selectedLoteId) {
        return false;
      }
      // Filtro por Status
      if (statusFilter !== 'todos' && reg.process_status !== statusFilter) {
        return false;
      }
      // Filtro por Busca (Nome, CPF, Protocolo)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchNome = reg.nome.toLowerCase().includes(term);
        const matchDoc = reg.cpf_cnpj.includes(term);
        const matchProto = reg.protocol_code && reg.protocol_code.toLowerCase().includes(term);
        if (!matchNome && !matchDoc && !matchProto) {
          return false;
        }
      }
      return true;
    });
  }, [registros, selectedLoteId, statusFilter, searchTerm]);

  // Selecionar todos os registros filtrados
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredRegistros.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Execução de transição em lote
  const handleExecuteBatch = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessingBatch(true);
    try {
      const res = await fetch('/api/registros/batch-transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          paraStatus: batchTargetStatus,
          motivo:
            batchMotivo.trim() ||
            `Transição judicial coletiva para status '${batchTargetStatus}' executada pelo Admin`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowBatchModal(false);
        setSelectedIds([]);
        setBatchMotivo('');
        onRefreshData();
      } else {
        alert(data.error || 'Falha ao executar transição em lote.');
      }
    } catch {
      alert('Erro de conexão com o servidor.');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  // Exportar lista da ação coletiva em CSV
  const handleExportCSV = () => {
    const headers = [
      'Protocolo ABDCM',
      'Ação Coletiva',
      'Processo Judicial',
      'Nome Associado',
      'CPF / CNPJ',
      'Status Processual',
      'Valor Centavos',
      'Vara / Tribunal',
      'Data de Protocolo',
    ];

    const rows = filteredRegistros.map((reg) => {
      const lote = lotes.find((l) => l.id === reg.lote_id);
      return [
        reg.protocol_code || '',
        lote?.titulo || lote?.codigo || 'Ação Coletiva',
        lote?.numero_processo || 'Em distribuição',
        reg.nome,
        unmaskedDocs[reg.id] || reg.cpf_cnpj,
        reg.process_status,
        reg.unit_price,
        lote?.vara_tribunal || 'TRF-3',
        lote?.data_protocolo || '-',
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `acoes_coletivas_abdcm_${selectedLoteId}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Institucional da Aba Processos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#148296]/10 text-[#148296] flex items-center justify-center shrink-0 mt-0.5 border border-[#148296]/20">
              <Gavel className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Ações Coletivas & Processos Judiciais (ABDCM)
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {lotes.length} Ações Registradas
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Visão detalhada de cada Ação Coletiva ajuizada perante a Justiça Federal, liminares
                deferidas, juizados e expedição de ofícios aos 4 birôs (Serasa, SPC Brasil, Boa Vista
                SCPC e Cenprot).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2 text-xs font-bold text-[#148296] bg-white hover:bg-slate-50 border border-[#148296]/40 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar Petição / CSV
            </button>
            <button
              type="button"
              onClick={() => setShowAndamentoModal(true)}
              className="px-3.5 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Lançar Andamento Judicial
            </button>
          </div>
        </div>
      </div>

      {/* 2. Grid de Cards: Cada Ação Coletiva com dados judiciais detalhados */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Ações Coletivas Cadastradas
            </span>
            <span className="text-[11px] text-slate-500">
              (Clique em um card para filtrar e visualizar todos os processos desta ação)
            </span>
          </div>
          {selectedLoteId !== 'todos' && (
            <button
              type="button"
              onClick={() => setSelectedLoteId('todos')}
              className="text-xs font-bold text-[#148296] hover:underline cursor-pointer flex items-center gap-1"
            >
              Ver Todas as Ações
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card: Todas as Ações */}
          <div
            onClick={() => setSelectedLoteId('todos')}
            className={`p-4 rounded-xl border transition-all cursor-pointer bg-white relative flex flex-col justify-between ${
              selectedLoteId === 'todos'
                ? 'border-[#148296] ring-2 ring-[#148296]/20 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 hover:shadow-2xs'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  Visão Geral
                </span>
                {selectedLoteId === 'todos' && (
                  <span className="w-2 h-2 rounded-full bg-[#148296]"></span>
                )}
              </div>
              <h4 className="text-sm font-bold text-slate-900">Todas as Ações Coletivas</h4>
              <p className="text-xs text-slate-500 mt-1">
                Total consolidado de todos os associados em todas as ações judiciais.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Total de Associados:</span>
              <strong className="text-slate-900 font-bold">{registros.length}</strong>
            </div>
          </div>

          {/* Cards individuais para cada Ação Coletiva */}
          {lotes.map((lote) => {
            const isSelected = selectedLoteId === lote.id;
            const loteRegistros = registros.filter((r) => r.lote_id === lote.id);
            const pagosCount = loteRegistros.filter((r) => r.process_status === 'pago').length;
            const protocoladosCount = loteRegistros.filter(
              (r) => r.process_status === 'protocolado'
            ).length;
            const baixadosCount = loteRegistros.filter(
              (r) => r.process_status === 'baixado'
            ).length;

            return (
              <div
                key={lote.id}
                onClick={() => setSelectedLoteId(lote.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer bg-white relative flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#148296] ring-2 ring-[#148296]/20 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        lote.status === 'aberto'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : lote.status === 'processando'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : lote.status === 'concluido'
                          ? 'bg-slate-100 text-slate-700 border border-slate-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {lote.status === 'aberto'
                        ? 'Captação & Conciliação'
                        : lote.status === 'processando'
                        ? 'Protocolada em Juízo'
                        : lote.status === 'concluido'
                        ? 'Baixada nos Birôs'
                        : 'Fechada'}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-bold text-[#148296] flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Ativa
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-slate-900">{lote.titulo}</h4>

                  {/* Número do Processo Judicial */}
                  <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mb-0.5">
                      <span>PROCESSO JUDICIAL:</span>
                      {lote.numero_processo && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyProcesso(lote.numero_processo!);
                          }}
                          className="text-[#148296] hover:text-[#0f6b7c] cursor-pointer flex items-center gap-1"
                          title="Copiar número do processo"
                        >
                          {copiedProcesso === lote.numero_processo ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> Copiado
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5">
                              <Copy className="w-3 h-3" /> Copiar
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                    <p className="font-mono font-bold text-slate-800 text-[11px] truncate">
                      {lote.numero_processo || 'Em distribuição judicial'}
                    </p>
                  </div>

                  {/* Detalhes de Vara e Juiz */}
                  <div className="mt-2.5 space-y-1 text-[11px] text-slate-600">
                    <p className="flex items-center gap-1.5 truncate">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{lote.vara_tribunal || 'TRF-3'}</span>
                    </p>
                    {lote.juiz && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Gavel className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{lote.juiz}</span>
                      </p>
                    )}
                    {lote.liminar_status && (
                      <p className="flex items-center gap-1.5 text-emerald-700 font-medium">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">Liminar: {lote.liminar_status}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Métricas do Lote */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Associados vinculados:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900">{loteRegistros.length}</span>
                    {protocoladosCount > 0 && (
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">
                        {protocoladosCount} prot.
                      </span>
                    )}
                    {baixadosCount > 0 && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                        {baixadosCount} baix.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Painel de Destaque da Ação Coletiva Selecionada (Se houver seleção de lote específico) */}
      {currentLote && (
        <div className="bg-slate-900 text-white rounded-xl p-5 shadow-sm border border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Ação Coletiva em Foco
                </span>
                <span className="text-xs text-slate-400">• Código: {currentLote.codigo}</span>
              </div>
              <h3 className="text-lg font-bold text-white mt-1">{currentLote.titulo}</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                {currentLote.descricao ||
                  'Ação Coletiva movida pela ABDCM visando o cancelamento e baixa de apontamentos cadastrais indevidos.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="bg-slate-800/80 border border-slate-700 px-3.5 py-2 rounded-lg text-xs">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Processo Judicial</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-bold text-emerald-400">
                    {currentLote.numero_processo || 'Em autuação'}
                  </span>
                  {currentLote.numero_processo && (
                    <button
                      type="button"
                      onClick={() => handleCopyProcesso(currentLote.numero_processo!)}
                      className="text-slate-300 hover:text-white cursor-pointer"
                      title="Copiar"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700 px-3.5 py-2 rounded-lg text-xs">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Vara & Foro</p>
                <p className="font-semibold text-white mt-0.5">
                  {currentLote.vara_tribunal || '1ª Vara Cível Federal SP'}
                </p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700 px-3.5 py-2 rounded-lg text-xs">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Liminar Concedida</p>
                <p className="font-bold text-emerald-400 mt-0.5">
                  {currentLote.liminar_status || 'Deferida c/ Ofícios'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Barra de Filtros, Busca e Ações em Lote */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar associado por nome, CPF/CNPJ ou protocolo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none"
            />
          </div>

          <select
            value={selectedLoteId}
            onChange={(e) => setSelectedLoteId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none text-slate-700 font-medium cursor-pointer"
          >
            <option value="todos">Filtrar: Todas as Ações</option>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.titulo}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none text-slate-700 font-medium cursor-pointer"
          >
            <option value="todos">Todos os status processuais</option>
            <option value="pendente">Pendente</option>
            <option value="enviado">Enviado</option>
            <option value="aguardando_pagamento">Aguardando Pagamento</option>
            <option value="pago">Pago</option>
            <option value="protocolado">Protocolado</option>
            <option value="baixado">Baixado (Concluído)</option>
            <option value="reprovado">Reprovado</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {filteredRegistros.length} de {registros.length} associados
          </span>

          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBatchModal(true)}
              className="px-3 py-1.5 rounded-lg bg-[#148296] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-[#0f6b7c] transition-colors shadow-2xs"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Transitar Selecionados ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* 5. Tabela Completa de Associados / Processos da Ação Coletiva */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredRegistros.length > 0 &&
                      selectedIds.length === filteredRegistros.length
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-slate-300 text-[#148296] focus:ring-[#148296] cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3">Protocolo ABDCM</th>
                <th className="px-4 py-3">Ação Coletiva</th>
                <th className="px-4 py-3">Associado / Razão Social</th>
                <th className="px-4 py-3">CPF / CNPJ</th>
                <th className="px-4 py-3">Status do Processo</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredRegistros.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    Nenhum registro ou processo encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredRegistros.map((reg) => {
                  const isSelected = selectedIds.includes(reg.id);
                  const isRevealed = !!unmaskedDocs[reg.id];
                  const lote = lotes.find((l) => l.id === reg.lote_id);

                  return (
                    <tr
                      key={reg.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-cyan-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(reg.id)}
                          className="rounded border-slate-300 text-[#148296] focus:ring-[#148296] cursor-pointer"
                        />
                      </td>

                      {/* Protocolo */}
                      <td className="px-4 py-3.5 font-mono text-[11px] font-semibold text-slate-600">
                        {reg.protocol_code || `ABDCM-${reg.id.slice(0, 8)}`}
                      </td>

                      {/* Ação Coletiva */}
                      <td className="px-4 py-3.5 font-medium text-slate-900">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {lote?.codigo || 'AC'}
                        </span>
                      </td>

                      {/* Nome do Associado */}
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-900">{reg.nome}</p>
                        <span className="text-[10px] text-slate-400">
                          Origem: {reg.origem === 'planilha' ? 'Planilha' : 'Manual'}
                        </span>
                      </td>

                      {/* CPF / CNPJ mascarado com auditoria */}
                      <td className="px-4 py-3.5 font-mono text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={
                              isRevealed
                                ? 'text-amber-700 font-bold bg-amber-50 px-1 rounded'
                                : 'text-slate-600'
                            }
                          >
                            {isRevealed ? unmaskedDocs[reg.id] : reg.cpf_cnpj}
                          </span>
                          {!isRevealed ? (
                            <button
                              type="button"
                              onClick={() => onRevealDocument(reg.id)}
                              title="Revelar CPF/CNPJ (registra auditoria LGPD)"
                              className="text-slate-400 hover:text-[#148296] cursor-pointer p-0.5 rounded transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span
                              title="Documento revelado sob auditoria LGPD"
                              className="text-amber-600"
                            >
                              <Lock className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* StatusBadge */}
                      <td className="px-4 py-3.5">
                        <StatusBadge status={reg.process_status} />
                      </td>

                      {/* Preço */}
                      <td className="px-4 py-3.5 font-semibold text-slate-800">
                        {formatCurrencyBRL(reg.unit_price)}
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenTimeline(reg)}
                            className="p-1 text-slate-400 hover:text-[#148296] hover:bg-slate-100 rounded-md cursor-pointer transition-colors"
                            title="Ver linha do tempo judicial"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenTransition(reg)}
                            className="p-1 text-slate-400 hover:text-[#148296] hover:bg-slate-100 rounded-md cursor-pointer transition-colors"
                            title="Alterar status judicial"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé da tabela com paginação / contagem */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>
            Exibindo <strong>{filteredRegistros.length}</strong> de{' '}
            <strong>{registros.length}</strong> processos cadastrados
          </span>
          <div className="flex items-center gap-3">
            <span>
              Selecionados: <strong>{selectedIds.length}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* MODAL: Transição em Lote */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-[#148296]" />
                Transitar Status em Lote
              </h3>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Você selecionou <strong>{selectedIds.length} associado(s)</strong> para avanço coletivo
              no processo judicial.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Novo Status Processual
                </label>
                <select
                  value={batchTargetStatus}
                  onChange={(e) => setBatchTargetStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30 text-slate-800 font-semibold cursor-pointer"
                >
                  <option value="protocolado">Protocolado em Juízo (Ofício emitido)</option>
                  <option value="baixado">Baixado nos 4 Birôs (Limpa Nome Concluído)</option>
                  <option value="pago">Pago / Conciliado</option>
                  <option value="reprovado">Reprovado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo da Transição Judicial
                </label>
                <textarea
                  rows={3}
                  value={batchMotivo}
                  onChange={(e) => setBatchMotivo(e.target.value)}
                  placeholder="Ex: Protocolo da petição inicial com liminar deferida na 1ª Vara Cível Federal..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30 text-slate-800"
                ></textarea>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteBatch}
                disabled={isProcessingBatch}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isProcessingBatch ? 'Processando...' : 'Confirmar Transição'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Lançar Andamento Judicial */}
      {showAndamentoModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Gavel className="w-4 h-4 text-[#148296]" />
                Lançar Andamento Judicial Oficial
              </h3>
              <button
                type="button"
                onClick={() => setShowAndamentoModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Registre despachos, decisões interlocutórias, expedição de ofícios aos birôs ou
              cumprimento de sentença para a Ação Coletiva.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ação Coletiva de Destino
                </label>
                <select
                  defaultValue={selectedLoteId !== 'todos' ? selectedLoteId : lotes[0]?.id}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30 text-slate-800 font-semibold"
                >
                  {lotes.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.titulo} — Proc. {l.numero_processo || 'Em autuação'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tipo de Andamento / Despacho
                </label>
                <select className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30 text-slate-800">
                  <option>Liminar Deferida com expedição imediata de ofícios aos birôs</option>
                  <option>Ofício Eletrônico transmitido a Serasa, SPC, Boa Vista e Cenprot</option>
                  <option>Cumprimento de Tutela Provisória confirmado pelos órgãos</option>
                  <option>Juntada de Comprovante de Pagamento e Emenda à Petição</option>
                  <option>Sentença Procedente Transitada em Julgado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Texto da Certidão / Observações da Secretaria
                </label>
                <textarea
                  rows={3}
                  value={andamentoTexto}
                  onChange={(e) => setAndamentoTexto(e.target.value)}
                  placeholder="Informações adicionais do despacho judicial..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30 text-slate-800"
                ></textarea>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowAndamentoModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  alert('Andamento judicial registrado com sucesso na Ação Coletiva!');
                  setShowAndamentoModal(false);
                  setAndamentoTexto('');
                  onRefreshData();
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                Registrar Andamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
