import React, { useState, useEffect } from 'react';
import { Lote, Registro, Associado } from '../domain/types.js';
import { StatusBadge } from './StatusBadge.js';
import { formatCurrencyBRL } from '../lib/money/index.js';
import {
  UserPlus,
  UploadCloud,
  Send,
  Search,
  Filter,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  MessageCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  FileSpreadsheet,
  FileCheck2,
  Calendar,
  Building2,
  Shield,
  BookOpen,
  DollarSign,
  HelpCircle,
  Check,
} from 'lucide-react';
import { CadastrarNomeModal } from './partner/CadastrarNomeModal.js';
import { ImportarListaModal } from './partner/ImportarListaModal.js';
import { EnviarListaModal } from './partner/EnviarListaModal.js';
import { PixPagamentoModal } from './partner/PixPagamentoModal.js';
import { MinhasListasView } from './partner/MinhasListasView.js';
import { ManualParceiroView } from './partner/ManualParceiroView.js';
import { HomeView } from './partner/HomeView.js';

interface SubmissaoData {
  id: string;
  nomes_count: number;
  valor_total: number;
  payment_status: 'pendente' | 'pago' | 'expirado' | 'cancelado';
  submetido_em: string;
}

interface ParceiroPortalProps {
  lotes: Lote[];
  registros: Registro[];
  associados: Associado[];
  parceiroTab?: string;
  session?: {
    nome?: string;
    email?: string;
    role?: string;
  } | null;
  onSelectParceiroTab?: (tab: string) => void;
  onOpenTimeline: (reg: Registro) => void;
  onRefreshData?: () => void;
}

export const ParceiroPortal: React.FC<ParceiroPortalProps> = ({
  lotes,
  registros,
  associados,
  parceiroTab = 'enviar-limpa-nome',
  session,
  onSelectParceiroTab,
  onOpenTimeline,
  onRefreshData,
}) => {
  const loteVigente = lotes.find((l) => l.id === 'lote-124') || lotes[0];
  const precoUnitario = loteVigente?.preco_por_nome || 25000;
  const nomeLoteVigente = loteVigente?.nome || 'AÇÃO COLETIVA 124';

  // Estados locais
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submissoes, setSubmissoes] = useState<SubmissaoData[]>([]);

  // Modais
  const [showCadastrarModal, setShowCadastrarModal] = useState(false);
  const [showImportarModal, setShowImportarModal] = useState(false);
  const [showEnviarModal, setShowEnviarModal] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [activeSubmissao, setActiveSubmissao] = useState<SubmissaoData | null>(null);

  // Carrega submissões pendentes
  const loadSubmissoes = () => {
    fetch('/api/submissoes')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: SubmissaoData[]) => {
        setSubmissoes(data);
        const pending = data.find((s) => s.payment_status === 'pendente');
        if (pending) {
          setActiveSubmissao(pending);
        } else if (data.length > 0) {
          setActiveSubmissao(data[0]);
        }
      })
      .catch((err) => console.error('Erro ao carregar submissões:', err));
  };

  useEffect(() => {
    loadSubmissoes();
  }, []);

  // Filtros de registros
  const filteredRegistros = registros.filter((r) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        (r.nome || '').toLowerCase().includes(q) ||
        (r.cpf_cnpj || '').toLowerCase().includes(q) ||
        (r.protocol_code && r.protocol_code.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (statusFilter !== 'todos' && r.process_status !== statusFilter) {
      return false;
    }
    return true;
  });

  // Métricas
  const pendentesCount = registros.filter((r) => r.process_status === 'pendente').length;
  const enviadosCount = registros.filter((r) => r.process_status === 'enviado').length;
  const pagosCount = registros.filter((r) => r.process_status === 'pago').length;
  const baixadosCount = registros.filter((r) => r.process_status === 'baixado').length;

  const totalNomes = registros.length;
  const totalValor = totalNomes * precoUnitario;

  // Seleção múltipla
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

  // Exclusão de registro pendente
  const handleDeleteRegistro = async (id: string) => {
    if (!confirm('Deseja realmente excluir este registro da lista?')) return;
    try {
      const res = await fetch(`/api/registros/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onRefreshData?.();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Envio de lote para processamento
  const handleConfirmEnvio = async () => {
    const idsToSend =
      selectedIds.length > 0
        ? selectedIds
        : registros.filter((r) => r.process_status === 'pendente').map((r) => r.id);

    if (idsToSend.length === 0) {
      alert('Nenhum registro pendente para enviar.');
      return;
    }

    const res = await fetch('/api/submissoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registroIds: idsToSend }),
    });

    if (res.ok) {
      const data = await res.json();
      setActiveSubmissao(data.submissao);
      setShowPixModal(true);
      setSelectedIds([]);
      loadSubmissoes();
      onRefreshData?.();
    } else {
      const err = await res.json();
      alert(err.error || 'Erro ao submeter lote');
    }
  };

  // Cancelamento de submissão
  const handleCancelSubmissao = async (submissaoId: string) => {
    if (!confirm('Deseja cancelar esta submissão e desbloquear os nomes?')) return;
    try {
      const res = await fetch(`/api/submissoes/${submissaoId}`, { method: 'DELETE' });
      if (res.ok) {
        setActiveSubmissao(null);
        setShowPixModal(false);
        loadSubmissoes();
        onRefreshData?.();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Renderização de outras abas do menu ABDCM
  if (parceiroTab === 'home') {
    return (
      <HomeView
        session={session}
        loteVigente={loteVigente}
        registros={registros}
        onNavigateTab={(tab) => onSelectParceiroTab?.(tab)}
      />
    );
  }

  if (parceiroTab === 'minhas-listas') {
    return <MinhasListasView registros={registros} lotes={lotes} />;
  }

  if (parceiroTab === 'manual') {
    return <ManualParceiroView />;
  }

  if (parceiroTab === 'financeiro') {
    return (
      <div className="p-8 space-y-6 overflow-y-auto flex-1">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-[#148296]" />
              Financeiro & Faturas PIX
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Gestão de cobranças, comprovantes e conciliação bancária
            </p>
          </div>
          {activeSubmissao && activeSubmissao.payment_status === 'pendente' && (
            <button
              onClick={() => setShowPixModal(true)}
              className="px-4 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              Pagar Fatura Aberta
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Faturado
            </span>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {formatCurrencyBRL(totalValor)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">19 nomes cadastrados</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Preço Fixo por Nome
            </span>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              {formatCurrencyBRL(precoUnitario)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">AÇÃO COLETIVA 124 congelado</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Status Pagamento
            </span>
            <div className="mt-1 flex items-center gap-2">
              {activeSubmissao && activeSubmissao.payment_status === 'pago' ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ✔ Em Dia (Sem Pendências)
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  ⏳ Fatura PIX Pendente
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Histórico de Submissões */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Histórico de Faturas e Envios</h3>
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Código Fatura</th>
                <th className="px-6 py-3">Nomes</th>
                <th className="px-6 py-3">Valor Total</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {submissoes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    Nenhuma fatura gerada ainda. Submeta uma lista no menu Enviar Limpa Nome.
                  </td>
                </tr>
              ) : (
                submissoes.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-3 font-mono font-bold text-slate-900">#{sub.id}</td>
                    <td className="px-6 py-3">{sub.nomes_count} nomes</td>
                    <td className="px-6 py-3 font-bold text-slate-900">
                      {formatCurrencyBRL(sub.valor_total)}
                    </td>
                    <td className="px-6 py-3">
                      {sub.payment_status === 'pago' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          PAGO
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          PENDENTE
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 font-mono text-slate-500">
                      {new Date(sub.submetido_em).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => {
                          setActiveSubmissao(sub);
                          setShowPixModal(true);
                        }}
                        className="px-3 py-1 text-xs font-bold text-[#148296] hover:underline cursor-pointer"
                      >
                        {sub.payment_status === 'pago' ? 'Ver Recibo' : 'Pagar PIX'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Visualização de telas informativas dos outros menus (ex: Reprotocolo, Contrato, etc.)
  if (parceiroTab && parceiroTab !== 'enviar-limpa-nome') {
    const titles: Record<string, { name: string; desc: string }> = {
      reprotocolo: {
        name: 'Reprotocolo Judicial',
        desc: 'Solicitação de reanálise de apontamentos que retornaram aos birôs',
      },
      'reclame-aqui': {
        name: 'Reclame Aqui & Ouvidoria',
        desc: 'Canal prioritário de resolução de apontamentos e dúvidas do associado',
      },
      orcamento: {
        name: 'Simulador de Orçamento',
        desc: 'Cálculo de margem e precificação de lotes para associados',
      },
      contrato: {
        name: 'Contrato Limpa Nome',
        desc: 'Modelos e termos de adesão contratual da Ação Coletiva',
      },
      documentos: {
        name: 'Documentos de Apoio',
        desc: 'Material comercial, procurações padrão e apresentações institucionais',
      },
      academia: {
        name: 'Academia Limpa Nome',
        desc: 'Vídeos tutoriais, treinamentos e melhores práticas de captação',
      },
      'cnpj-inapto': {
        name: 'Regularização de CNPJ Inapto',
        desc: 'Módulo integrado de restabelecimento cadastral perante a Receita Federal',
      },
      'solicitar-diagnostico': {
        name: 'Solicitar Diagnóstico de Crédito',
        desc: 'Consulta preliminar de score e negativações nos 5 principais birôs',
      },
      'meus-diagnosticos': {
        name: 'Meus Diagnósticos',
        desc: 'Histórico de relatórios de crédito solicitados pelo parceiro',
      },
      home: {
        name: 'Painel Geral do Parceiro',
        desc: 'Resumo operacional e atalhos rápidos da ABDCM',
      },
      servicos: {
        name: 'Catálogo de Serviços',
        desc: 'Serviços jurídicos e de recuperação de crédito disponíveis',
      },
      eventos: {
        name: 'Calendário de Prazos & Lotes',
        desc: 'Cronograma quinzenal de fechamento e protocolos em juízo',
      },
    };

    const info = titles[parceiroTab] || {
      name: parceiroTab.toUpperCase(),
      desc: 'Módulo da plataforma ABDCM',
    };

    return (
      <div className="p-8 space-y-6 overflow-y-auto flex-1">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{info.name}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{info.desc}</p>
        </div>
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-2xs space-y-4 max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#148296]/10 text-[#148296] flex items-center justify-center font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Módulo Integrado e Operacional</h3>
              <p className="text-xs text-slate-500">Parceiro Rdz Consultoria Financeira credenciado</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Este módulo opera conectado à base de dados central da Ação Coletiva. Para submeter novos lotes de associados, acerte os nomes na tela principal <strong>Enviar Limpa Nome</strong>.
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // TELA PRINCIPAL: ENVIAR LIMPA NOME
  // ==========================================
  const pendingSubmissao = submissoes.find((s) => s.payment_status === 'pendente');

  return (
    <div className="p-8 space-y-6 overflow-y-auto flex-1 relative">
      {/* 1. Top Header com Título e Botões de Ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Ação Limpa Nome ABDCM
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Lista ativa: <strong className="text-slate-800 font-bold">{nomeLoteVigente}</strong>
          </p>
        </div>

        {/* Botões do Topo */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowCadastrarModal(true)}
            className="px-3.5 py-2 text-xs font-bold text-[#148296] bg-white hover:bg-slate-50 border border-[#148296]/40 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            + Cadastrar Nome
          </button>

          <button
            type="button"
            onClick={() => setShowImportarModal(true)}
            className="px-3.5 py-2 text-xs font-bold text-[#148296] bg-white hover:bg-slate-50 border border-[#148296]/40 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <UploadCloud className="w-4 h-4" />
            Importar Lista
          </button>

          <button
            type="button"
            onClick={() => setShowEnviarModal(true)}
            className="px-4 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Send className="w-4 h-4" />
            Enviar Lista
          </button>
        </div>
      </div>

      {/* 2. Stepper do Processo (4 Passos do Fluxo Limpa Nome) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
          {/* Passo 1 */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#148296] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              1
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">1. Cadastrar Nomes</p>
              <p className="text-[11px] text-slate-500">Insira nomes ou importe lista</p>
            </div>
          </div>

          {/* Passo 2 */}
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                enviadosCount > 0 || pagosCount > 0
                  ? 'bg-[#148296] text-white'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              2
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">2. Enviar Lista</p>
              <p className="text-[11px] text-slate-500">Confirme o envio da lista ativa</p>
            </div>
          </div>

          {/* Passo 3 */}
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                pagosCount > 0
                  ? 'bg-emerald-600 text-white'
                  : pendingSubmissao
                  ? 'bg-amber-500 text-white animate-pulse'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              3
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">3. Pagamento PIX</p>
              <p className="text-[11px] text-slate-500">Pague via PIX instantâneo</p>
            </div>
          </div>

          {/* Passo 4 */}
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                baixadosCount > 0
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              4
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">4. Processamento</p>
              <p className="text-[11px] text-slate-500">Acompanhe protocolo e baixa</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Aviso de Pagamento Pendente (se houver submissão aguardando PIX) */}
      {pendingSubmissao && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                Pagamento PIX Pendente ({pendingSubmissao.nomes_count} nomes)
              </h4>
              <p className="text-xs text-amber-700">
                Valor total:{' '}
                <strong className="font-bold">
                  {formatCurrencyBRL(pendingSubmissao.valor_total)}
                </strong>
                . Efetue o pagamento para liberação do protocolo judicial.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleCancelSubmissao(pendingSubmissao.id)}
              className="px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 rounded-lg cursor-pointer transition-colors"
            >
              Cancelar Envio
            </button>
            <button
              onClick={() => {
                setActiveSubmissao(pendingSubmissao);
                setShowPixModal(true);
              }}
              className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <QrCode className="w-4 h-4" />
              Ver QR Code PIX
            </button>
          </div>
        </div>
      )}

      {/* 4. Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, CPF ou protocolo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none text-slate-700 font-medium cursor-pointer"
          >
            <option value="todos">Todos os status</option>
            <option value="pendente">Pendente ({pendentesCount})</option>
            <option value="enviado">Enviado ({enviadosCount})</option>
            <option value="pago">Pago ({pagosCount})</option>
            <option value="baixado">Baixado ({baixadosCount})</option>
          </select>
        </div>

        {/* Contador Geral da Lista Ativa */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {totalNomes} nomes na lista ({formatCurrencyBRL(totalValor)})
          </span>
          {selectedIds.length > 0 && (
            <button
              onClick={() => setShowEnviarModal(true)}
              className="px-3 py-1 rounded-lg bg-[#148296] text-white font-bold text-xs flex items-center gap-1 cursor-pointer hover:bg-[#0f6b7c]"
            >
              <Send className="w-3 h-3" />
              Enviar Selecionados ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* 5. Tabela de Registros com os 19 Nomes Reais */}
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
                <th className="px-4 py-3">Protocolo</th>
                <th className="px-4 py-3">Nome / Razão Social</th>
                <th className="px-4 py-3">CPF / CNPJ</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Preço Unitário</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredRegistros.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                    Nenhum registro encontrado para a busca especificada.
                  </td>
                </tr>
              ) : (
                filteredRegistros.map((reg) => {
                  const isSelected = selectedIds.includes(reg.id);

                  return (
                    <tr
                      key={reg.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-sky-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(reg.id)}
                          className="rounded border-slate-300 text-[#148296] focus:ring-[#148296] cursor-pointer"
                        />
                      </td>

                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {reg.protocol_code || 'ABDCM-AC124-PEND'}
                      </td>

                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                        {reg.nome}
                      </td>

                      <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                        {reg.cpf_cnpj}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={reg.process_status} />
                      </td>

                      <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">
                        {formatCurrencyBRL(reg.unit_price || precoUnitario)}
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                          {reg.origem || 'manual'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            title="Histórico de Eventos"
                            onClick={() => onOpenTimeline(reg)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 cursor-pointer"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                          {!reg.is_locked && reg.process_status === 'pendente' && (
                            <button
                              type="button"
                              title="Excluir da Lista"
                              onClick={() => handleDeleteRegistro(reg.id)}
                              className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer com Resumo */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>{filteredRegistros.length} de {totalNomes} nomes listados</span>
          <div className="flex items-center gap-3">
            <span>
              Total selecionado: <strong>{selectedIds.length}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 6. Botão Flutuante de Ajuda WhatsApp */}
      <div className="fixed bottom-6 right-6 z-40">
        <a
          href="https://wa.me/5511999999999?text=Olá,%20preciso%20de%20ajuda%20no%20Portal%20do%20Parceiro%20ABDCM"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white px-4 py-2.5 rounded-full shadow-lg font-bold text-xs cursor-pointer transition-all hover:scale-105"
        >
          <MessageCircle className="w-4 h-4 fill-white" />
          <span>Precisa de ajuda?</span>
        </a>
      </div>

      {/* Modais */}
      <CadastrarNomeModal
        isOpen={showCadastrarModal}
        onClose={() => setShowCadastrarModal(false)}
        onSuccess={() => onRefreshData?.()}
      />

      <ImportarListaModal
        isOpen={showImportarModal}
        onClose={() => setShowImportarModal(false)}
        onSuccess={() => onRefreshData?.()}
      />

      <EnviarListaModal
        isOpen={showEnviarModal}
        onClose={() => setShowEnviarModal(false)}
        count={selectedIds.length > 0 ? selectedIds.length : pendentesCount || totalNomes}
        totalValueFormatted={formatCurrencyBRL(
          (selectedIds.length > 0 ? selectedIds.length : pendentesCount || totalNomes) * precoUnitario
        )}
        onConfirm={handleConfirmEnvio}
      />

      {activeSubmissao && (
        <PixPagamentoModal
          isOpen={showPixModal}
          onClose={() => setShowPixModal(false)}
          valorTotalFormatted={formatCurrencyBRL(activeSubmissao.valor_total)}
          submissaoId={activeSubmissao.id}
          onSimulatePaid={() => {
            loadSubmissoes();
            onRefreshData?.();
          }}
        />
      )}
    </div>
  );
};
