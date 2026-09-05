import React, { useState, useMemo } from 'react';
import { Submissao, Registro, Lote } from '../../domain/types.js';
import { formatCurrencyBRL } from '../../lib/money/index.js';
import { UserSession } from '../../server/mockDb.js';
import {
  DollarSign,
  Search,
  CheckCircle,
  XCircle,
  FileText,
  AlertTriangle,
  Clock,
  Download,
  Copy,
  Check,
  Building2,
  Receipt,
  ArrowUpRight,
  TrendingUp,
  UserCheck,
  CreditCard,
  QrCode,
  ShieldCheck,
  Eye,
} from 'lucide-react';

interface AdminFinanceiroTabProps {
  submissoes: Submissao[];
  registros: Registro[];
  lotes: Lote[];
  session: UserSession | null;
  onRefreshData: () => void;
}

export const AdminFinanceiroTab: React.FC<AdminFinanceiroTabProps> = ({
  submissoes,
  registros,
  lotes,
  session,
  onRefreshData,
}) => {
  const [subTab, setSubTab] = useState<'conciliacao' | 'extrato' | 'parceiros'>('conciliacao');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [selectedSubmissao, setSelectedSubmissao] = useState<Submissao | null>(
    submissoes.find((s) => s.payment_status === 'pendente') || submissoes[0] || null
  );
  const [copiedPix, setCopiedPix] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReprovarModal, setShowReprovarModal] = useState(false);
  const [reprovarMotivo, setReprovarMotivo] = useState('');

  const chavePixOficial = 'financeiro@abdcm.org.br';

  const handleCopyPix = () => {
    navigator.clipboard.writeText(chavePixOficial);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  // Métricas financeiras calculadas
  const faturamentoTotalCentavos = useMemo(() => {
    return submissoes
      .filter((s) => s.payment_status === 'pago')
      .reduce((acc, curr) => acc + curr.valor_total, 0);
  }, [submissoes]);

  const faturamentoPendenteCentavos = useMemo(() => {
    return submissoes
      .filter((s) => s.payment_status === 'pendente')
      .reduce((acc, curr) => acc + curr.valor_total, 0);
  }, [submissoes]);

  const totalNomesPagos = useMemo(() => {
    return registros.filter((r) => r.process_status === 'pago' || r.process_status === 'protocolado' || r.process_status === 'baixado').length;
  }, [registros]);

  const totalComissoesCentavos = useMemo(() => {
    // Estimativa de comissão do parceiro: R$ 15,00 por nome pago
    return totalNomesPagos * 1500;
  }, [totalNomesPagos]);

  // Submissões filtradas para o extrato
  const filteredSubmissoes = useMemo(() => {
    return submissoes.filter((sub) => {
      if (statusFilter !== 'todos' && sub.payment_status !== statusFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchId = sub.id.toLowerCase().includes(term);
        const matchParceiro = sub.parceiro_id.toLowerCase().includes(term);
        const matchLote = sub.lote_id.toLowerCase().includes(term);
        if (!matchId && !matchParceiro && !matchLote) return false;
      }
      return true;
    });
  }, [submissoes, statusFilter, searchTerm]);

  // Aprovar Submissão / Conciliação
  const handleAprovar = async (subId: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/submissoes/${subId}/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: 'Comprovante conferido e aprovado pelo operador financeiro' }),
      });
      const data = await res.json();
      if (res.ok) {
        onRefreshData();
        setSelectedSubmissao(null);
      } else {
        alert(data.error || 'Erro ao aprovar submissão.');
      }
    } catch {
      alert('Erro de conexão ao aprovar submissão.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Reprovar Submissão
  const handleReprovar = async () => {
    if (!selectedSubmissao) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/submissoes/${selectedSubmissao.id}/reprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motivo:
            reprovarMotivo.trim() ||
            'Comprovante divergente ou ilegível recusado na conciliação bancária',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowReprovarModal(false);
        setReprovarMotivo('');
        onRefreshData();
        setSelectedSubmissao(null);
      } else {
        alert(data.error || 'Erro ao reprovar submissão.');
      }
    } catch {
      alert('Erro de conexão ao reprovar submissão.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Exportar Extrato em CSV
  const handleExportExtratoCSV = () => {
    const headers = [
      'ID Transação',
      'Parceiro',
      'Lote / Ação Coletiva',
      'Qtd de Nomes',
      'Valor Total (Centavos)',
      'Valor Formatado',
      'Status Pagamento',
      'Data Submissão',
      'Data Confirmação',
      'Observações',
    ];

    const rows = filteredSubmissoes.map((sub) => {
      const lote = lotes.find((l) => l.id === sub.lote_id);
      return [
        sub.id,
        sub.parceiro_id === 'parc-001' ? 'Rdz Consultoria Financeira' : sub.parceiro_id,
        lote?.titulo || sub.lote_id,
        sub.nomes_count,
        sub.valor_total,
        formatCurrencyBRL(sub.valor_total),
        sub.payment_status,
        sub.submetido_em,
        sub.confirmado_em || '-',
        sub.motivo_observacao || '-',
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
      `extrato_financeiro_abdcm_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header com 4 Cards de Métricas Financeiras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Faturamento Confirmado
            </span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-900">
              {formatCurrencyBRL(faturamentoTotalCentavos)}
            </p>
            <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
              ✓ 100% conciliado e compensado
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Valores em Conciliação
            </span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-amber-700">
              {formatCurrencyBRL(faturamentoPendenteCentavos)}
            </p>
            <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
              {submissoes.filter((s) => s.payment_status === 'pendente').length} comprovante(s) pendente(s)
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Nomes Pagos & Prontos
            </span>
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-[#148296]">{totalNomesPagos} associados</p>
            <p className="text-[11px] text-slate-500 mt-0.5">R$ 55,00 por nome na Ação Coletiva</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Repasses / Comissões
            </span>
            <span className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-900">
              {formatCurrencyBRL(totalComissoesCentavos)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Provisão calculada de parceiros</p>
          </div>
        </div>
      </div>

      {/* 2. Banner com Dados Bancários & Conta PIX Oficial da ABDCM */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Conta Institucional & Chave PIX (ABDCM)
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                  Operando Ativa
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Razão Social: <strong>Associação Brasileira de Defesa do Consumidor e do Trabalhador</strong> • CNPJ: 45.892.124/0001-90
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400">Chave PIX E-mail:</span>
              <span className="font-mono font-bold text-slate-800">{chavePixOficial}</span>
              <button
                type="button"
                onClick={handleCopyPix}
                className="text-[#148296] hover:text-[#0f6b7c] cursor-pointer p-1 rounded transition-colors"
                title="Copiar Chave PIX"
              >
                {copiedPix ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-0.5 text-xs">
                    <Check className="w-3.5 h-3.5" /> Copiado!
                  </span>
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 mr-2">Bancos:</span>
              <span className="font-semibold text-slate-800">Santander (033) & Nu Pagamentos</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sub-navegação interna da Aba Financeiro */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setSubTab('conciliacao')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
            subTab === 'conciliacao'
              ? 'bg-[#148296] text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          Fila de Conciliação
          {submissoes.filter((s) => s.payment_status === 'pendente').length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black">
              {submissoes.filter((s) => s.payment_status === 'pendente').length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSubTab('extrato')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
            subTab === 'extrato'
              ? 'bg-[#148296] text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Extrato Financeiro & Histórico
        </button>

        <button
          type="button"
          onClick={() => setSubTab('parceiros')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
            subTab === 'parceiros'
              ? 'bg-[#148296] text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Desempenho por Parceiro
        </button>
      </div>

      {/* SUB-ABA 1: FILA DE CONCILIAÇÃO BANCÁRIA */}
      {subTab === 'conciliacao' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Lista de Submissões Pendentes */}
            <div className="lg:col-span-6 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Comprovantes em Análise ({submissoes.filter((s) => s.payment_status === 'pendente').length})
                </h4>
                <span className="text-[11px] text-slate-500">Selecione para auditar e aprovar</span>
              </div>

              {submissoes.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
                  Nenhuma submissão financeira pendente.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {submissoes.map((sub) => {
                    const isSelected = selectedSubmissao?.id === sub.id;
                    const lote = lotes.find((l) => l.id === sub.lote_id);

                    return (
                      <div
                        key={sub.id}
                        onClick={() => setSelectedSubmissao(sub)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer bg-white ${
                          isSelected
                            ? 'border-[#148296] ring-2 ring-[#148296]/20 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-slate-900">
                                #{sub.id}
                              </span>
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                  sub.payment_status === 'pago'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : sub.payment_status === 'pendente'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {sub.payment_status === 'pago'
                                  ? 'Conciliado / Pago'
                                  : sub.payment_status === 'pendente'
                                  ? 'Aguardando Conferência'
                                  : 'Reprovado'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 font-medium">
                              Parceiro: Rdz Consultoria Financeira
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Lote: {lote?.titulo || sub.lote_id} • {sub.nomes_count} associados
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-black text-slate-900">
                              {formatCurrencyBRL(sub.valor_total)}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              {new Date(sub.submetido_em).toLocaleString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Painel do Comprovante Selecionado & Ações */}
            <div className="lg:col-span-6">
              {selectedSubmissao ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4 sticky top-6">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                        Detalhes do Pagamento
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                        Submissão #{selectedSubmissao.id}
                      </h4>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                        selectedSubmissao.payment_status === 'pago'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : selectedSubmissao.payment_status === 'pendente'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {selectedSubmissao.payment_status === 'pago'
                        ? 'Conciliado'
                        : selectedSubmissao.payment_status === 'pendente'
                        ? 'Pendente de Análise'
                        : 'Reprovado'}
                    </span>
                  </div>

                  {/* Card que simula o comprovante bancário recebido */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3 font-mono">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-[11px] font-sans">
                      <span className="font-bold text-slate-700">COMPROVANTE DE TRANSAÇÃO PIX / TED</span>
                      <span className="text-slate-500">Autenticação: 8F2A.3391.EE40</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400">Favorecido:</span>
                        <p className="text-slate-800 font-bold">ABDCM - Associação Brasileira</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Chave PIX:</span>
                        <p className="text-slate-800 font-bold">{chavePixOficial}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Valor Pago:</span>
                        <p className="text-slate-900 font-bold text-sm">
                          {formatCurrencyBRL(selectedSubmissao.valor_total)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Quantidade de Nomes:</span>
                        <p className="text-slate-800 font-bold">{selectedSubmissao.nomes_count} associados</p>
                      </div>
                    </div>

                    {selectedSubmissao.motivo_observacao && (
                      <div className="pt-2 border-t border-slate-200 text-[11px] font-sans">
                        <span className="text-slate-500 font-semibold">Observações / Auditoria:</span>
                        <p className="text-slate-700 mt-0.5 bg-white p-2 rounded border border-slate-200">
                          {selectedSubmissao.motivo_observacao}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Ações Administrativas de Conciliação */}
                  {selectedSubmissao.payment_status === 'pendente' && (
                    <div className="pt-2 flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => setShowReprovarModal(true)}
                        disabled={isProcessing}
                        className="px-4 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Recusar Comprovante
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAprovar(selectedSubmissao.id)}
                        disabled={isProcessing}
                        className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Aprovar Pagamento & Conciliar
                      </button>
                    </div>
                  )}

                  {selectedSubmissao.payment_status === 'pago' && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-medium">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Transação validada em {new Date(selectedSubmissao.confirmado_em || '').toLocaleString('pt-BR')}.
                        Todos os nomes deste lote foram liberados para o protocolo da Ação Coletiva.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
                  Selecione uma submissão para conferir o comprovante e conciliar.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-ABA 2: EXTRATO FINANCEIRO & HISTÓRICO DE SUBMISSÕES */}
      {subTab === 'extrato' && (
        <div className="space-y-4">
          {/* Filtros do Extrato */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-[260px]">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar transação por ID ou parceiro..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none text-slate-700 font-medium cursor-pointer"
              >
                <option value="todos">Todos os status</option>
                <option value="pago">Conciliados (Pagos)</option>
                <option value="pendente">Aguardando Validação</option>
                <option value="reprovado">Reprovados</option>
              </select>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportExtratoCSV}
                className="px-3.5 py-2 text-xs font-bold text-[#148296] bg-white hover:bg-slate-50 border border-[#148296]/40 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar Extrato CSV
              </button>

              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold">
                {filteredSubmissoes.length} lançamentos
              </span>
            </div>
          </div>

          {/* Tabela do Extrato Financeiro */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">ID Transação</th>
                    <th className="px-5 py-3">Parceiro</th>
                    <th className="px-5 py-3">Lote / Ação</th>
                    <th className="px-5 py-3">Associados</th>
                    <th className="px-5 py-3">Valor Total</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Data / Hora</th>
                    <th className="px-5 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredSubmissoes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                        Nenhuma transação encontrada no extrato.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissoes.map((sub) => {
                      const lote = lotes.find((l) => l.id === sub.lote_id);

                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-3.5 font-mono font-bold text-[#148296]">
                            #{sub.id}
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-slate-900">
                            {sub.parceiro_id === 'parc-001'
                              ? 'Rdz Consultoria Financeira'
                              : sub.parceiro_id}
                          </td>
                          <td className="px-5 py-3.5 font-medium text-slate-700">
                            {lote?.codigo || sub.lote_id}
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-slate-800">
                            {sub.nomes_count} nomes
                          </td>
                          <td className="px-5 py-3.5 font-bold text-slate-900">
                            {formatCurrencyBRL(sub.valor_total)}
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                sub.payment_status === 'pago'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : sub.payment_status === 'pendente'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {sub.payment_status === 'pago'
                                ? 'Conciliado'
                                : sub.payment_status === 'pendente'
                                ? 'Aguardando'
                                : 'Reprovado'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 font-mono text-[11px]">
                            {new Date(sub.submetido_em).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSubmissao(sub);
                                setSubTab('conciliacao');
                              }}
                              className="text-xs font-bold text-[#148296] hover:underline cursor-pointer"
                            >
                              Ver Comprovante
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-ABA 3: DESEMPENHO POR PARCEIRO */}
      {subTab === 'parceiros' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Parceiros Consultores Cadastrados</h4>
                <p className="text-xs text-slate-500">
                  Acompanhamento de volume financeiro, comissões geradas e repasses.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Parceiro</th>
                    <th className="px-6 py-3.5">CNPJ</th>
                    <th className="px-6 py-3.5">Total de Nomes</th>
                    <th className="px-6 py-3.5">Faturamento Bruto</th>
                    <th className="px-6 py-3.5">Comissão Gerada</th>
                    <th className="px-6 py-3.5">Status de Repasse</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#148296]/10 text-[#148296] font-bold flex items-center justify-center text-xs">
                          RDZ
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">Rdz Consultoria Financeira</p>
                          <span className="text-[10px] text-slate-400">Responsável: Carlos Eduardo Rdz</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-600">38.921.004/0001-88</td>
                    <td className="px-6 py-4 font-bold text-slate-800">{registros.length} associados</td>
                    <td className="px-6 py-4 font-bold text-emerald-700">
                      {formatCurrencyBRL(faturamentoTotalCentavos)}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {formatCurrencyBRL(totalComissoesCentavos)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Regular / Em dia
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reprovar Comprovante */}
      {showReprovarModal && selectedSubmissao && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-600" />
                Recusar Comprovante de Pagamento
              </h3>
              <button
                type="button"
                onClick={() => setShowReprovarModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Informe o motivo da recusa para a submissão <strong>#{selectedSubmissao.id}</strong>.
              O parceiro será notificado para envio de novo comprovante.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo da Recusa / Inconsistência
              </label>
              <textarea
                rows={3}
                value={reprovarMotivo}
                onChange={(e) => setReprovarMotivo(e.target.value)}
                placeholder="Ex: Comprovante ilegível, valor divergente da soma dos associados..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-rose-500/30 text-slate-800"
              ></textarea>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowReprovarModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReprovar}
                disabled={isProcessing}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? 'Gravando...' : 'Confirmar Recusa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
