import React, { useState, useEffect, useRef } from 'react';
import { Lote, Registro, Associado, Contestacao, Servico, Contrato } from '../domain/types.js';
import { StatusDocumentos, documentosEsperados } from '../lib/documentos/index.js';
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
  Paperclip,
  Users,
  ShoppingBag,
  FileSignature,
  Download,
} from 'lucide-react';
import { CadastrarNomeModal } from './partner/CadastrarNomeModal.js';
import { ImportarListaModal } from './partner/ImportarListaModal.js';
import { EnviarListaModal } from './partner/EnviarListaModal.js';
import { AnexarDocumentosModal } from './partner/AnexarDocumentosModal.js';
import { PixPagamentoModal } from './partner/PixPagamentoModal.js';
import { MinhasListasView } from './partner/MinhasListasView.js';
import { HomeView } from './partner/HomeView.js';

interface SubmissaoData {
  id: string;
  lote_id: string;
  nomes_count: number;
  valor_total: number;
  payment_status: 'pendente' | 'pago' | 'expirado' | 'reprovado' | 'cancelado';
  submetido_em: string;
  tem_comprovante?: boolean;
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
  const loteVigente = lotes.find((l) => l.status === 'aberto') ?? lotes.find((l) => l.id === 'lote-124') ?? lotes[0];
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
  const [showDocumentosModal, setShowDocumentosModal] = useState(false);
  const [documentosStatus, setDocumentosStatus] = useState<Record<string, StatusDocumentos>>({});

  const loadDocumentosStatus = () => {
    fetch('/api/documentos/status')
      .then((res) => (res.ok ? res.json() : {}))
      .then(setDocumentosStatus)
      .catch(() => setDocumentosStatus({}));
  };

  useEffect(() => {
    loadDocumentosStatus();
  }, []);
  const [showPixModal, setShowPixModal] = useState(false);
  const [activeSubmissao, setActiveSubmissao] = useState<SubmissaoData | null>(null);
  const [activePixPayload, setActivePixPayload] = useState<string | undefined>(undefined);
  const [pixReal, setPixReal] = useState(false);

  useEffect(() => {
    fetch('/api/config/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((status: { pix?: { configurado: boolean } } | null) => setPixReal(Boolean(status?.pix?.configurado)))
      .catch(() => setPixReal(false));
  }, []);

  // Abre o modal de PIX buscando o QR real já gerado pra essa submissão
  // (provedor mock ou Asaas, conforme PIX_PROVIDER) — se ainda não tiver
  // nenhuma cobrança (ex.: submissão antiga), o modal cai no payload de
  // exemplo dele mesmo.
  const handleOpenPix = (sub: SubmissaoData) => {
    setActiveSubmissao(sub);
    setActivePixPayload(undefined);
    setShowPixModal(true);
    fetch(`/api/submissoes/${sub.id}/pix`)
      .then((res) => (res.ok ? res.json() : null))
      .then((cobranca: { copia_e_cola: string } | null) => setActivePixPayload(cobranca?.copia_e_cola))
      .catch(() => setActivePixPayload(undefined));
  };

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

  // Reclame Aqui / Contestações
  const [contestacoes, setContestacoes] = useState<Contestacao[]>([]);
  const [contestacaoLoteId, setContestacaoLoteId] = useState('');
  const [contestacaoMotivo, setContestacaoMotivo] = useState('Lista concluiu e o nome não baixou');
  const [contestacaoObservacao, setContestacaoObservacao] = useState('');
  const [isSubmittingContestacao, setIsSubmittingContestacao] = useState(false);
  const [contestacaoError, setContestacaoError] = useState<string | null>(null);
  const [contestacaoSucesso, setContestacaoSucesso] = useState(false);

  const loadContestacoes = () => {
    fetch('/api/contestacoes')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Contestacao[]) => setContestacoes(data))
      .catch((err) => console.error('Erro ao carregar contestações:', err));
  };

  useEffect(() => {
    loadContestacoes();
  }, []);

  // Catálogo de Serviços & Contrato Limpa Nome
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [contrato, setContrato] = useState<Contrato | null>(null);

  useEffect(() => {
    fetch('/api/servicos')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Servico[]) => setServicos(data))
      .catch(() => setServicos([]));

    fetch('/api/contrato')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Contrato | null) => setContrato(data))
      .catch(() => setContrato(null));
  }, []);

  const handleAbrirContestacao = async () => {
    if (!contestacaoLoteId) {
      setContestacaoError('Selecione a lista referente à contestação.');
      return;
    }
    setIsSubmittingContestacao(true);
    setContestacaoError(null);
    setContestacaoSucesso(false);
    try {
      const res = await fetch('/api/contestacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loteId: contestacaoLoteId,
          motivo: contestacaoMotivo,
          observacao: contestacaoObservacao,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao abrir solicitação');
      setContestacaoSucesso(true);
      setContestacaoLoteId('');
      setContestacaoObservacao('');
      loadContestacoes();
    } catch (err) {
      setContestacaoError(err instanceof Error ? err.message : 'Erro ao abrir solicitação');
    } finally {
      setIsSubmittingContestacao(false);
    }
  };

  // Anexar novo comprovante em submissão reprovada
  const comprovanteInputRef = useRef<HTMLInputElement>(null);
  const [comprovanteTargetId, setComprovanteTargetId] = useState<string | null>(null);
  const [uploadingComprovante, setUploadingComprovante] = useState(false);

  const handleClickAnexarComprovante = (subId: string) => {
    setComprovanteTargetId(subId);
    comprovanteInputRef.current?.click();
  };

  const handleComprovanteSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !comprovanteTargetId) return;
    setUploadingComprovante(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/submissoes/${comprovanteTargetId}/comprovante`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comprovanteBase64: base64, mimeType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao anexar comprovante');
      loadSubmissoes();
      onRefreshData?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao anexar comprovante');
    } finally {
      setUploadingComprovante(false);
      setComprovanteTargetId(null);
    }
  };

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
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Não foi possível excluir este registro.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao excluir registro.');
    }
  };

  // Envio de lote para processamento
  const handleConfirmEnvio = async () => {
    const idsToSend =
      selectedIds.length > 0
        ? selectedIds
        : registros.filter((r) => r.process_status === 'pendente').map((r) => r.id);

    if (idsToSend.length === 0) {
      throw new Error('Nenhum registro pendente para enviar.');
    }

    const res = await fetch('/api/submissoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registroIds: idsToSend }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      // Lança pro modal de confirmação: ele precisa saber que falhou pra
      // não fechar sozinho e mostrar o erro, em vez de sumir sem enviar nada.
      throw new Error(err?.error || 'Erro ao submeter lote. Tente novamente.');
    }

    const data = await res.json();
    setActiveSubmissao(data.submissao);
    setActivePixPayload(data.pixCobranca?.copia_e_cola);
    setShowPixModal(true);
    setSelectedIds([]);
    loadSubmissoes();
    onRefreshData?.();
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
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Não foi possível cancelar esta submissão.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao cancelar submissão.');
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
    return (
      <MinhasListasView
        registros={registros}
        lotes={lotes}
        submissoes={submissoes}
        documentosStatus={documentosStatus}
      />
    );
  }

  if (parceiroTab === 'financeiro') {
    const totalEnviadoCentavos = submissoes.reduce((acc, s) => acc + s.valor_total, 0);
    const aprovadosCentavos = submissoes
      .filter((s) => s.payment_status === 'pago')
      .reduce((acc, s) => acc + s.valor_total, 0);
    const pendentesCentavos = submissoes
      .filter((s) => s.payment_status === 'pendente')
      .reduce((acc, s) => acc + s.valor_total, 0);
    const nomesProcessados = submissoes
      .filter((s) => s.payment_status === 'pago')
      .reduce((acc, s) => acc + s.nomes_count, 0);

    const statusBadge = (status: SubmissaoData['payment_status']) => {
      const map: Record<SubmissaoData['payment_status'], string> = {
        pendente: 'bg-amber-50 text-amber-800 border-amber-200',
        pago: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        expirado: 'bg-slate-100 text-slate-600 border-slate-200',
        reprovado: 'bg-rose-50 text-rose-700 border-rose-200',
        cancelado: 'bg-slate-100 text-slate-500 border-slate-200',
      };
      const label: Record<SubmissaoData['payment_status'], string> = {
        pendente: 'Pendente',
        pago: 'Pago',
        expirado: 'Expirado',
        reprovado: 'Reprovado',
        cancelado: 'Cancelado',
      };
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${map[status]}`}
        >
          {label[status]}
        </span>
      );
    };

    return (
      <div className="p-8 space-y-6 overflow-y-auto flex-1">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-[#148296]" />
            Financeiro
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhe suas listas enviadas, pagamentos e comprovantes
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Enviado
            </span>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {formatCurrencyBRL(totalEnviadoCentavos)}
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Aprovados
            </span>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              {formatCurrencyBRL(aprovadosCentavos)}
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Pendentes
            </span>
            <p className="text-2xl font-black text-amber-600 mt-1">
              {formatCurrencyBRL(pendentesCentavos)}
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Nomes Processados
            </span>
            <p className="text-2xl font-black text-slate-900 mt-1">{nomesProcessados}</p>
          </div>
        </div>

        {/* Listas Enviadas */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Listas Enviadas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Lista</th>
                  <th className="px-6 py-3">Data de Envio</th>
                  <th className="px-6 py-3">Qtd Nomes</th>
                  <th className="px-6 py-3">Valor</th>
                  <th className="px-6 py-3">Status Pagamento</th>
                  <th className="px-6 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {submissoes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                      Nenhuma lista enviada ainda. Submeta uma lista no menu Enviar Limpa Nome.
                    </td>
                  </tr>
                ) : (
                  submissoes.map((sub) => {
                    const lote = lotes.find((l) => l.id === sub.lote_id);
                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/80">
                        <td className="px-6 py-3 font-bold text-slate-900 whitespace-nowrap">
                          {lote?.nome || sub.lote_id}
                        </td>
                        <td className="px-6 py-3 font-mono text-slate-500 whitespace-nowrap">
                          {new Date(sub.submetido_em).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-3">{sub.nomes_count}</td>
                        <td className="px-6 py-3 font-bold text-slate-900 whitespace-nowrap">
                          {formatCurrencyBRL(sub.valor_total)}
                        </td>
                        <td className="px-6 py-3">{statusBadge(sub.payment_status)}</td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {sub.payment_status === 'reprovado' && (
                              <button
                                type="button"
                                disabled={uploadingComprovante}
                                onClick={() => handleClickAnexarComprovante(sub.id)}
                                className="px-3 py-1 text-xs font-bold text-[#148296] hover:underline cursor-pointer flex items-center gap-1 disabled:opacity-50"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                                {uploadingComprovante && comprovanteTargetId === sub.id
                                  ? 'Enviando...'
                                  : 'Anexar Comprovante'}
                              </button>
                            )}
                            {sub.payment_status === 'pendente' && (
                              <button
                                type="button"
                                onClick={() => handleOpenPix(sub)}
                                className="px-3 py-1 text-xs font-bold text-[#148296] hover:underline cursor-pointer"
                              >
                                Pagar PIX
                              </button>
                            )}
                            {(sub.payment_status === 'pendente' ||
                              sub.payment_status === 'reprovado') && (
                              <button
                                type="button"
                                title="Excluir lista"
                                onClick={() => handleCancelSubmissao(sub.id)}
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
        </div>

        <input
          ref={comprovanteInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleComprovanteSelected}
        />

        {activeSubmissao && (
          <PixPagamentoModal
            isOpen={showPixModal}
            onClose={() => setShowPixModal(false)}
            valorTotalFormatted={formatCurrencyBRL(activeSubmissao.valor_total)}
            submissaoId={activeSubmissao.id}
            pixPayload={activePixPayload}
            permitirSimular={!pixReal}
            onSimulatePaid={() => {
              loadSubmissoes();
              onRefreshData?.();
            }}
          />
        )}
      </div>
    );
  }

  if (parceiroTab === 'reclame-aqui') {
    const lotesElegiveis = lotes.filter((l) => l.status === 'concluido');
    const contestacaoStatusBadge = (status: Contestacao['status']) => {
      const map: Record<Contestacao['status'], string> = {
        aberta: 'bg-amber-50 text-amber-800 border-amber-200',
        respondida: 'bg-sky-50 text-sky-700 border-sky-200',
        resolvida: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        rejeitada: 'bg-rose-50 text-rose-700 border-rose-200',
      };
      const label: Record<Contestacao['status'], string> = {
        aberta: 'Aberta',
        respondida: 'Respondida',
        resolvida: 'Resolvida',
        rejeitada: 'Rejeitada',
      };
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${map[status]}`}>
          {label[status]}
        </span>
      );
    };

    return (
      <div className="p-8 space-y-6 overflow-y-auto flex-1 max-w-3xl">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-[#148296]" />
            Reclame Aqui
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Canal para contestar um nome que não baixou após a conclusão da Ação Coletiva. A
            abertura de solicitação libera automaticamente <strong>72 horas</strong> após a
            lista ser concluída pela ABDCM, e nossa equipe responde em até{' '}
            <strong>48 horas</strong> (SLA).
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Nova Solicitação</h3>

          {contestacaoError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
              {contestacaoError}
            </div>
          )}
          {contestacaoSucesso && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-medium">
              Solicitação enviada com sucesso. Nosso time responde em até 48h.
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Motivo
            </label>
            <input
              type="text"
              value={contestacaoMotivo}
              onChange={(e) => setContestacaoMotivo(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Selecione a Lista
            </label>
            <select
              value={contestacaoLoteId}
              onChange={(e) => setContestacaoLoteId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none cursor-pointer"
            >
              <option value="">Selecione...</option>
              {lotesElegiveis.length === 0 ? (
                <option value="" disabled>
                  Nenhuma lista concluída ainda
                </option>
              ) : (
                lotesElegiveis.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Observação (opcional)
            </label>
            <textarea
              value={contestacaoObservacao}
              onChange={(e) => setContestacaoObservacao(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none resize-none"
              placeholder="Detalhe o caso, se necessário..."
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={isSubmittingContestacao}
              onClick={handleAbrirContestacao}
              className="px-4 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {isSubmittingContestacao ? 'Enviando...' : 'Enviar Solicitação'}
            </button>
          </div>
        </div>

        {contestacoes.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Minhas Solicitações</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {contestacoes.map((c) => (
                <div key={c.id} className="px-6 py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{c.motivo}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Aberta em {new Date(c.aberta_em).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  {contestacaoStatusBadge(c.status)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (parceiroTab === 'servicos') {
    const servicosAtivos = servicos.filter((s) => s.ativo);
    return (
      <div className="p-8 space-y-6 overflow-y-auto flex-1">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-[#148296]" />
            Serviços
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Catálogo de serviços disponibilizados pela ABDCM
          </p>
        </div>

        {servicosAtivos.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-2xs text-center text-xs text-slate-400">
            Nenhum serviço disponível no momento. Fale com a equipe ABDCM para mais informações.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {servicosAtivos.map((s) => (
              <div
                key={s.id}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{s.nome}</h3>
                  {s.descricao && (
                    <p className="text-xs text-slate-500 mt-1">{s.descricao}</p>
                  )}
                  <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                    {s.usa_listas ? 'Por listas' : 'Serviço único'}
                  </span>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-black text-[#148296] text-base">
                    {formatCurrencyBRL(s.preco)}
                  </span>
                  <span className="text-slate-500">{s.prazo_dias} dias</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (parceiroTab === 'contrato') {
    return (
      <div className="p-8 space-y-6 overflow-y-auto flex-1 max-w-2xl">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSignature className="w-6 h-6 text-[#148296]" />
            Contrato Limpa Nome
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Modelo de contrato disponibilizado pela ABDCM
          </p>
        </div>

        {contrato ? (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#148296]/10 text-[#148296] flex items-center justify-center shrink-0">
                <FileSignature className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{contrato.nome_arquivo}</p>
                <p className="text-xs text-slate-500">
                  Atualizado em {new Date(contrato.atualizado_em).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
            <a
              href={`data:${contrato.mime_type};base64,${contrato.conteudo_base64}`}
              download={contrato.nome_arquivo}
              className="px-4 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4" />
              Baixar
            </a>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-2xs text-center text-xs text-slate-400">
            Nenhum contrato disponibilizado pela ABDCM ainda.
          </div>
        )}
      </div>
    );
  }

  // Visualização de telas informativas dos demais menus (ex: Eventos — em definição)
  if (parceiroTab && parceiroTab !== 'enviar-limpa-nome') {
    const titles: Record<string, { name: string; desc: string }> = {
      eventos: {
        name: 'Eventos & Notícias',
        desc: 'Novidades, comunicados e calendário da ABDCM',
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

  // Nesta tela o status que importa pro parceiro é o do PAGAMENTO da lista,
  // não a fase jurídica do processo (isso fica na aba Minhas Listas/Processos).
  const paymentStatusBadge = (status: Registro['process_status']) => {
    const map: Record<string, { label: string; classes: string }> = {
      pendente: { label: 'Não Enviado', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
      enviado: { label: 'Pendente de Pagamento', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
      aguardando_pagamento: { label: 'Pendente de Pagamento', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
      reprovado: { label: 'Cancelada por Falta de Pagamento', classes: 'bg-rose-50 text-rose-700 border-rose-200' },
      cancelado: { label: 'Cancelada', classes: 'bg-zinc-100 text-zinc-600 border-zinc-300' },
    };
    const config = map[status] ?? { label: 'Aprovado', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${config.classes}`}
      >
        {config.label}
      </span>
    );
  };

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
            onClick={() => setShowDocumentosModal(true)}
            className="px-3.5 py-2 text-xs font-bold text-[#148296] bg-white hover:bg-slate-50 border border-[#148296]/40 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Anexar Documentos
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
              onClick={() => handleOpenPix(pendingSubmissao)}
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
            <option value="todos">Todos os pagamentos</option>
            <option value="pendente">Não Enviado ({pendentesCount})</option>
            <option value="enviado">Pendente de Pagamento ({enviadosCount})</option>
            <option value="pago">Aprovado ({pagosCount})</option>
            <option value="baixado">Aprovado — Baixado ({baixadosCount})</option>
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
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3">Docs</th>
                <th className="px-4 py-3">Preço Unitário</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredRegistros.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-slate-400">
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
                        {paymentStatusBadge(reg.process_status)}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {(() => {
                          const status = documentosStatus[reg.associado_id];
                          // Ficha associativa fica de fora do indicador rápido — ainda não
                          // tem geração automática, então cobraria um documento que a
                          // maioria não tem como anexar ainda.
                          const esperados = documentosEsperados(reg.tipo_documento).filter((d) => d.tipo !== 'ficha_associativa');
                          const completo = esperados.every((d) => status?.[d.tipo]);
                          return (
                            <span
                              title={esperados.map((d) => `${d.label}: ${status?.[d.tipo] ? 'ok' : 'falta'}`).join(' · ')}
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                                completo
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-400 border-slate-200'
                              }`}
                            >
                              {esperados
                                .map((d) => (status?.[d.tipo] ? d.tipo.slice(0, 3).toUpperCase() : '—'))
                                .join(' / ')}
                            </span>
                          );
                        })()}
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

      <AnexarDocumentosModal
        isOpen={showDocumentosModal}
        onClose={() => setShowDocumentosModal(false)}
        onConcluido={loadDocumentosStatus}
      />

      {activeSubmissao && (
        <PixPagamentoModal
          isOpen={showPixModal}
          onClose={() => setShowPixModal(false)}
          valorTotalFormatted={formatCurrencyBRL(activeSubmissao.valor_total)}
          submissaoId={activeSubmissao.id}
          pixPayload={activePixPayload}
            permitirSimular={!pixReal}
          onSimulatePaid={() => {
            loadSubmissoes();
            onRefreshData?.();
          }}
        />
      )}
    </div>
  );
};
