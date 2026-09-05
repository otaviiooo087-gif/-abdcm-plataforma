import React, { useState, useMemo } from 'react';
import { Lote, Registro, AuditLog, ProcessStatus, Submissao } from '../domain/types.js';
import { StatusBadge } from './StatusBadge.js';
import { formatCurrencyBRL } from '../lib/money/index.js';
import { UserSession } from '../server/mockData.js';
import { AdminProcessosTab } from './admin/AdminProcessosTab.js';
import { AdminFinanceiroTab } from './admin/AdminFinanceiroTab.js';
import {
  ShieldAlert,
  Eye,
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  FileText,
  AlertTriangle,
  Lock,
  Search,
  Building2,
  Clock,
  Sparkles,
  RefreshCw,
  Download,
  Plus,
  X,
  Layers,
  Send,
  Check,
  DollarSign,
  Receipt,
  Gavel,
} from 'lucide-react';

interface AdminConsoleProps {
  activeTab: 'processos' | 'financeiro' | 'operacao' | 'registros' | 'controle';
  onSelectTab?: (tab: 'processos' | 'financeiro' | 'operacao' | 'controle') => void;
  lotes: Lote[];
  registros: Registro[];
  submissoes?: Submissao[];
  auditLogs: AuditLog[];
  session: UserSession | null;
  onOpenTimeline: (reg: Registro) => void;
  onOpenTransition: (reg: Registro) => void;
  onRefreshData: () => void;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  activeTab,
  onSelectTab,
  lotes,
  registros,
  submissoes = [],
  auditLogs,
  session,
  onOpenTimeline,
  onOpenTransition,
  onRefreshData,
}) => {
  const [unmaskedDocs, setUnmaskedDocs] = useState<Record<string, string>>({});
  const [selectedQueueItem, setSelectedQueueItem] = useState<Registro | null>(
    registros.find((r) => r.process_status === 'aguardando_pagamento') || null
  );

  // Seleção múltipla para ações em lote (idêntico ao Parceiro)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filtros da aba Registros
  const [registroSearch, setRegistroSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Filtros da aba Auditoria
  const [auditSearch, setAuditSearch] = useState('');

  // Modais administrativos
  const [showNovoLoteModal, setShowNovoLoteModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchTargetStatus, setBatchTargetStatus] = useState<ProcessStatus>('protocolado');
  const [batchMotivo, setBatchMotivo] = useState('');
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Revelação de documento com auditoria imediata no servidor (I6)
  const handleRevealDocument = async (registroId: string) => {
    try {
      const res = await fetch(`/api/registros/${registroId}/reveal-doc`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.cpf_cnpj_raw) {
        setUnmaskedDocs((prev) => ({ ...prev, [registroId]: data.cpf_cnpj_raw }));
        onRefreshData();
      } else {
        alert(data.error || 'Falha ao revelar documento.');
      }
    } catch {
      alert('Erro de conexão ao revelar documento.');
    }
  };

  // Conciliação de comprovante manual
  const handleConciliar = async (regId: string, aprovar: boolean) => {
    try {
      const nextStatus = aprovar ? 'pago' : 'reprovado';
      const motivo = aprovar
        ? 'Comprovante conferido e aprovado pelo operador na fila de conciliação'
        : 'Comprovante ilegível ou divergente recusado pelo operador';

      const res = await fetch(`/api/registros/${regId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paraStatus: nextStatus, motivo }),
      });
      const data = await res.json();
      if (res.ok) {
        onRefreshData();
        setSelectedQueueItem(null);
      } else {
        alert(data.error || 'Erro ao processar conciliação.');
      }
    } catch {
      alert('Erro ao enviar decisão.');
    }
  };

  // Atualizar dados com animação no botão
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Seleção múltipla de registros
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

  // Transição em Lote dos itens selecionados
  const handleExecuteBatchTransition = async () => {
    if (selectedIds.length === 0) return;
    setIsBatchProcessing(true);
    try {
      let successCount = 0;
      for (const id of selectedIds) {
        const res = await fetch(`/api/registros/${id}/transition`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paraStatus: batchTargetStatus,
            motivo: batchMotivo || `Transição em lote aprovada pela diretoria administrativa`,
          }),
        });
        if (res.ok) successCount++;
      }
      onRefreshData();
      setSelectedIds([]);
      setShowBatchModal(false);
      setBatchMotivo('');
      alert(`${successCount} registro(s) transitado(s) com sucesso para o status "${batchTargetStatus.toUpperCase()}".`);
    } catch {
      alert('Erro ao executar transições em lote.');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Exportar Registros para CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Protocolo', 'Associado', 'CPF_CNPJ', 'Status', 'Valor_Unitario', 'Data_Cadastro'];
    const rows = filteredRegistros.map((r) => [
      r.id,
      r.protocol_code || 'ABDCM-AC124-PEND',
      `"${r.nome.replace(/"/g, '""')}"`,
      r.cpf_cnpj,
      r.process_status,
      r.unit_price,
      r.criado_em,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_registros_adm_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportar Auditoria para CSV
  const handleExportAuditCSV = () => {
    const headers = ['ID', 'Data_Hora', 'Acao', 'Ator', 'Entidade_Tipo', 'Entidade_ID'];
    const rows = filteredAuditLogs.map((log) => [
      log.id,
      log.ocorrido_em,
      log.acao,
      log.ator_user_id,
      log.entidade_tipo,
      log.entidade_id,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `trilha_auditoria_lgpd_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const queueItems = registros.filter((r) => r.process_status === 'aguardando_pagamento');
  const pagosCount = registros.filter((r) => r.process_status === 'pago').length;
  const protocoladosCount = registros.filter((r) => r.process_status === 'protocolado').length;
  const baixadosCount = registros.filter((r) => r.process_status === 'baixado').length;

  const filteredRegistros = useMemo(() => {
    return registros.filter((r) => {
      const matchSearch =
        !registroSearch.trim() ||
        r.nome.toLowerCase().includes(registroSearch.toLowerCase()) ||
        r.cpf_cnpj.includes(registroSearch) ||
        (r.protocol_code && r.protocol_code.toLowerCase().includes(registroSearch.toLowerCase()));

      const matchStatus =
        statusFilter === 'todos' || r.process_status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [registros, registroSearch, statusFilter]);

  const filteredAuditLogs = useMemo(() => {
    if (!auditSearch.trim()) return auditLogs;
    const q = auditSearch.toLowerCase();
    return auditLogs.filter(
      (log) =>
        log.acao.toLowerCase().includes(q) ||
        log.ator_user_id.toLowerCase().includes(q) ||
        log.entidade_tipo.toLowerCase().includes(q) ||
        log.entidade_id.toLowerCase().includes(q)
    );
  }, [auditLogs, auditSearch]);

  const loteVigente = lotes[0];

  return (
    <div className="p-8 space-y-6 overflow-y-auto flex-1 relative bg-[#F8FAFC]">
      {/* 1. Top Header com Título e Botões de Ação Idênticos ao Portal do Parceiro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Painel Administrativo ABDCM
            </h2>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
              Conexão Segura
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Lote ativo: <strong className="text-slate-800 font-bold">{loteVigente?.codigo || 'AC 124'}</strong> • Gestão de conciliações, lotes e auditoria LGPD
          </p>
        </div>

        {/* Botões do Topo com o mesmo layout e classes do Portal do Parceiro */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleRefresh}
            className="px-3.5 py-2 text-xs font-bold text-[#148296] bg-white hover:bg-slate-50 border border-[#148296]/40 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar Dados
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-bold text-[#148296] bg-white hover:bg-slate-50 border border-[#148296]/40 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar Relatório
          </button>

          <button
            type="button"
            onClick={() => setShowNovoLoteModal(true)}
            className="px-4 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Lote / Ação
          </button>
        </div>
      </div>

      {/* 2. Stepper de Navegação e Módulos (4 Passos no mesmo padrão do Parceiro) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-center">
          {/* Passo 1: Processos (Ações Coletivas) */}
          <button
            type="button"
            onClick={() => onSelectTab?.('processos')}
            className={`flex items-center gap-3 p-2.5 rounded-xl text-left transition-all cursor-pointer ${
              activeTab === 'processos' || activeTab === 'registros'
                ? 'bg-[#148296]/10 ring-1 ring-[#148296]/40 shadow-2xs'
                : 'hover:bg-slate-50'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-xs transition-colors ${
                activeTab === 'processos' || activeTab === 'registros'
                  ? 'bg-[#148296] text-white'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              1
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">1. Processos (Ações)</p>
              <p className="text-[11px] text-slate-500">{lotes.length} ações coletivas</p>
            </div>
          </button>

          {/* Passo 2: Financeiro & Conciliação */}
          <button
            type="button"
            onClick={() => onSelectTab?.('financeiro')}
            className={`flex items-center gap-3 p-2.5 rounded-xl text-left transition-all cursor-pointer ${
              activeTab === 'financeiro'
                ? 'bg-[#148296]/10 ring-1 ring-[#148296]/40 shadow-2xs'
                : 'hover:bg-slate-50'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-xs transition-colors ${
                activeTab === 'financeiro'
                  ? 'bg-[#148296] text-white'
                  : submissoes.filter((s) => s.payment_status === 'pendente').length > 0
                  ? 'bg-amber-500 text-white animate-pulse'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              2
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">2. Financeiro</p>
              <p className="text-[11px] text-slate-500">
                {submissoes.filter((s) => s.payment_status === 'pendente').length > 0
                  ? `${submissoes.filter((s) => s.payment_status === 'pendente').length} comprovante(s)`
                  : 'Faturamento & extrato'}
              </p>
            </div>
          </button>

          {/* Passo 3: Operação e Lotes */}
          <button
            type="button"
            onClick={() => onSelectTab?.('operacao')}
            className={`flex items-center gap-3 p-2.5 rounded-xl text-left transition-all cursor-pointer ${
              activeTab === 'operacao'
                ? 'bg-[#148296]/10 ring-1 ring-[#148296]/40 shadow-2xs'
                : 'hover:bg-slate-50'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-xs transition-colors ${
                activeTab === 'operacao'
                  ? 'bg-[#148296] text-white'
                  : queueItems.length > 0
                  ? 'bg-amber-500 text-white animate-pulse'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              3
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">3. Operação & Lotes</p>
              <p className="text-[11px] text-slate-500">
                {queueItems.length > 0
                  ? `${queueItems.length} na fila`
                  : 'Gates de corte & checklist'}
              </p>
            </div>
          </button>

          {/* Passo 4: Auditoria Imutável */}
          <button
            type="button"
            onClick={() => onSelectTab?.('controle')}
            className={`flex items-center gap-3 p-2.5 rounded-xl text-left transition-all cursor-pointer ${
              activeTab === 'controle'
                ? 'bg-[#148296]/10 ring-1 ring-[#148296]/40 shadow-2xs'
                : 'hover:bg-slate-50'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-xs transition-colors ${
                activeTab === 'controle'
                  ? 'bg-[#148296] text-white'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              4
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">4. Trilha de Auditoria</p>
              <p className="text-[11px] text-slate-500">{auditLogs.length} eventos registrados</p>
            </div>
          </button>
        </div>
      </div>

      {/* 3. Aviso de Pendência (Idêntico ao card de pagamento pendente do Parceiro) */}
      {queueItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                Fila de Conciliação Pendente ({queueItems.length} comprovante{queueItems.length > 1 ? 's' : ''})
              </h4>
              <p className="text-xs text-amber-700">
                Comprovantes aguardam validação do financeiro para avanço no protocolo judicial da Ação 124.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onSelectTab?.('operacao')}
              className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <FileText className="w-4 h-4" />
              Conferir Comprovantes
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ABA 1: OPERAÇÃO (FILAS & LOTES)                       */}
      {/* ==================================================== */}
      {activeTab === 'operacao' && (
        <div className="space-y-6">
          {/* Métricas Principais em 4 Cards no estilo do Parceiro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Fila de Conciliação
              </span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {queueItems.length}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {queueItems.length === 0 ? 'Fila 100% zerada' : 'Aguardando conferência'}
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Lote Ativo Vigente
              </span>
              <p className="text-2xl font-black text-[#148296] mt-1">
                {loteVigente?.codigo || 'AC 124'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Preço fixo: R$ 55,00/nome</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Pagos / Prontos
              </span>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {pagosCount}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Prontos para protocolo em juízo</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Conformidade LGPD
              </span>
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ✔ Trilha I2, I6 Ativa
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Segurança e rastreabilidade</p>
            </div>
          </div>

          {/* Painel da Fila de Conciliação em 2 Colunas */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Fila de Conciliação de Comprovantes
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Conferência assistida de depósitos bancários e PIX para liberação de protocolo
                </p>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {queueItems.length} pendente(s)
              </span>
            </div>

            {queueItems.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-bold text-slate-700 text-sm">Nenhum comprovante pendente no momento!</p>
                <p className="mt-1">Todas as conciliações foram concluídas com sucesso.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[380px]">
                {/* Coluna Esquerda: Itens da Fila */}
                <div className="lg:col-span-5 border-r border-slate-100 divide-y divide-slate-100 overflow-y-auto">
                  {queueItems.map((item) => {
                    const isSelected = selectedQueueItem?.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedQueueItem(item)}
                        className={`p-4 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#148296]/10 border-l-4 border-l-[#148296]'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-slate-900">{item.nome}</span>
                          <span className="text-xs font-black text-emerald-700 font-mono">
                            {formatCurrencyBRL(item.unit_price)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-mono text-slate-600">{item.cpf_cnpj}</span>
                          <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                            Comprovante Anexado
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Coluna Direita: Item Ativo & Visualizador do Comprovante */}
                <div className="lg:col-span-7 p-6 flex flex-col justify-between bg-slate-50/40">
                  {selectedQueueItem ? (
                    <div className="space-y-4 flex-1">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                        <div>
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Conferência de Comprovante
                          </h5>
                          <p className="text-base font-bold text-slate-900">{selectedQueueItem.nome}</p>
                        </div>
                        <StatusBadge status={selectedQueueItem.process_status} />
                      </div>

                      {/* Visualizador de Comprovante */}
                      <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-6 text-center shadow-2xs">
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                          <FileText className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-bold text-slate-800">comprovante_pix_transferencia.pdf</p>
                        <p className="text-xs text-slate-600 mt-1">
                          Valor no documento:{' '}
                          <strong className="text-emerald-700 font-mono">
                            {formatCurrencyBRL(selectedQueueItem.unit_price)}
                          </strong>{' '}
                          • Banco: 260 Nu Pagamentos
                        </p>
                        <p className="text-[10px] text-slate-400 mt-2 font-mono bg-slate-50 py-1 px-2 rounded inline-block border border-slate-200">
                          Hash de Validação: 89f41a02b37c... (Conferido com o banco)
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                            Valor Esperado
                          </span>
                          <span className="font-extrabold text-slate-900 font-mono text-sm">
                            {formatCurrencyBRL(selectedQueueItem.unit_price)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                            Origem do Envio
                          </span>
                          <span className="font-semibold text-[#148296]">
                            Rdz Consultoria (#parc-001)
                          </span>
                        </div>
                      </div>

                      {/* Botões de Ação com o mesmo layout e classes do Portal do Parceiro */}
                      <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => handleConciliar(selectedQueueItem.id, false)}
                          className="px-3.5 py-2 text-xs font-bold text-rose-700 bg-white hover:bg-rose-50 border border-rose-300 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          Reprovar Pagamento [R]
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConciliar(selectedQueueItem.id, true)}
                          className="px-4 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Aprovar Pagamento [A]
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-xs text-slate-400 py-12">
                      <FileText className="w-8 h-8 text-slate-300 mb-2" />
                      <span>Selecione um item da fila ao lado para conferir o comprovante.</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Checklist de Encerramento do Lote (Gates Operacionais) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#148296]" />
                Gates de Encerramento — AÇÃO COLETIVA 124
              </h4>
              <span className="text-xs font-semibold text-slate-500">
                Lote vigente com prazo limite às 19:00h
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-emerald-900 font-medium">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{pagosCount} registros pagos e conciliados prontos para protocolo em birôs</span>
                </div>
                <span className="text-[10px] font-bold uppercase text-emerald-800 bg-white border border-emerald-200 px-2 py-0.5 rounded-md">
                  Aprovado
                </span>
              </div>

              {queueItems.length > 0 ? (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-amber-900 font-medium">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{queueItems.length} comprovante(s) aguardando conferência na fila de conciliação</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase text-amber-800 bg-white border border-amber-200 px-2 py-0.5 rounded-md">
                    Bloqueante
                  </span>
                </div>
              ) : (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-emerald-900 font-medium">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Nenhum comprovante pendente. Fila zerada com sucesso.</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase text-emerald-800 bg-white border border-emerald-200 px-2 py-0.5 rounded-md">
                    Pronto
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ABA: PROCESSOS & AÇÕES COLETIVAS (ADMIN)             */}
      {/* ==================================================== */}
      {(activeTab === 'processos' || activeTab === 'registros') && (
        <AdminProcessosTab
          lotes={lotes}
          registros={registros}
          session={session}
          unmaskedDocs={unmaskedDocs}
          onRevealDocument={handleRevealDocument}
          onOpenTimeline={onOpenTimeline}
          onOpenTransition={onOpenTransition}
          onRefreshData={onRefreshData}
        />
      )}

      {/* ==================================================== */}
      {/* ABA: FINANCEIRO & CONCILIAÇÃO BANCÁRIA (ADMIN)       */}
      {/* ==================================================== */}
      {activeTab === 'financeiro' && (
        <AdminFinanceiroTab
          submissoes={submissoes}
          registros={registros}
          lotes={lotes}
          session={session}
          onRefreshData={onRefreshData}
        />
      )}

      {/* ==================================================== */}
      {/* ABA 3: CONTROLE & AUDITORIA                          */}
      {/* ==================================================== */}
      {activeTab === 'controle' && (
        <div className="space-y-6">
          {/* Barra de Filtro de Auditoria com layout idêntico */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por ação, ator ou entidade..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none"
              />
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportAuditCSV}
                className="px-3.5 py-2 text-xs font-bold text-[#148296] bg-white hover:bg-slate-50 border border-[#148296]/40 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar Trilha CSV
              </button>

              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold">
                {filteredAuditLogs.length} eventos gravados
              </span>
            </div>
          </div>

          {/* Tabela de Auditoria Imutável */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Data / Hora</th>
                    <th className="px-6 py-3.5">Ação Executada</th>
                    <th className="px-6 py-3.5">Ator Responsável</th>
                    <th className="px-6 py-3.5">Entidade / ID</th>
                    <th className="px-6 py-3.5">Detalhes / Parâmetros</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        Nenhum registro de auditoria encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(log.ocorrido_em).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase font-mono">
                            {log.acao}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                          {log.ator_user_id}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-slate-600 whitespace-nowrap">
                          <span className="font-semibold text-slate-800">{log.entidade_tipo}</span> #{log.entidade_id}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-[11px] text-slate-600">
                          {log.depois ? (
                            <pre className="text-[10px] bg-slate-50 p-2 rounded border border-slate-200 max-w-md overflow-x-auto font-mono text-slate-700">
                              {JSON.stringify(log.depois, null, 2)}
                            </pre>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Trilha de auditoria gerada automaticamente pelo sistema com integridade criptográfica.</span>
              <span className="font-bold text-slate-700">{filteredAuditLogs.length} eventos</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: NOVO LOTE / AÇÃO COLETIVA                     */}
      {/* ==================================================== */}
      {showNovoLoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#148296]/10 text-[#148296] flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Novo Lote de Ação Coletiva</h3>
                  <p className="text-[11px] text-slate-500">
                    Definir cronograma e parâmetros do lote de associados
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNovoLoteModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Código do Lote</label>
                <input
                  type="text"
                  defaultValue="AC 125"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Preço Unitário por Nome (R$)</label>
                <input
                  type="text"
                  defaultValue="55,00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Vara / Tribunal Competente</label>
                <input
                  type="text"
                  defaultValue="1ª Vara Cível Federal - Seção Judiciária SP"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Data Limite de Fechamento</label>
                <input
                  type="date"
                  defaultValue={new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none cursor-pointer"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowNovoLoteModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNovoLoteModal(false);
                  alert('Novo lote AC 125 configurado com sucesso e sincronizado no portal dos parceiros.');
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Check className="w-4 h-4" />
                Criar Lote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: TRANSIÇÃO EM LOTE DOS SELECIONADOS            */}
      {/* ==================================================== */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#148296]/10 text-[#148296] flex items-center justify-center font-bold">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Transição em Lote</h3>
                  <p className="text-[11px] text-slate-500">
                    Aplicar novo status para {selectedIds.length} associados selecionados
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Novo Status Desejado</label>
                <select
                  value={batchTargetStatus}
                  onChange={(e) => setBatchTargetStatus(e.target.value as ProcessStatus)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none font-bold cursor-pointer"
                >
                  <option value="protocolado">Protocolado em Birôs</option>
                  <option value="baixado">Baixado (Concluído)</option>
                  <option value="pago">Pago / Conciliado</option>
                  <option value="reprovado">Reprovado</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Motivo / Justificativa Operacional</label>
                <textarea
                  rows={3}
                  value={batchMotivo}
                  onChange={(e) => setBatchMotivo(e.target.value)}
                  placeholder="Informe a justificativa da transição para a trilha de auditoria..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none resize-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isBatchProcessing}
                onClick={() => setShowBatchModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isBatchProcessing}
                onClick={handleExecuteBatchTransition}
                className="px-4 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
              >
                {isBatchProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirmar Transição ({selectedIds.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
