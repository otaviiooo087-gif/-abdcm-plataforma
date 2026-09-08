import React, { useState, useEffect } from 'react';
import { Associado, Registro, Lote, StatusFiliacao } from '../../domain/types.js';
import { StatusBadge } from '../StatusBadge.js';
import { StatusDocumentos, documentosEsperados } from '../../lib/documentos/index.js';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Search,
  Eye,
  EyeOff,
  ExternalLink,
  X,
  Phone,
  Mail,
  ArrowLeft,
  FileText,
  ShieldOff,
  ShieldCheck,
  Calendar,
  MapPin,
} from 'lucide-react';

interface AdminAssociadosTabProps {
  associados: Associado[];
  registros: Registro[];
  lotes: Lote[];
  onRefreshData: () => void;
}

const STATUS_FILIACAO_LABEL: Record<StatusFiliacao, { label: string; classes: string }> = {
  pre_cadastro: { label: 'Pré-cadastro', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  ficha_enviada: { label: 'Ficha Enviada', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  ficha_assinada: { label: 'Ficha Assinada', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  ativo: { label: 'Ativo', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  inativo: { label: 'Inativo', classes: 'bg-zinc-100 text-zinc-600 border-zinc-300' },
};

const MOTIVO_BLOQUEIO_LABEL: Record<string, string> = {
  solicitacao_associado: 'Solicitação do associado',
  suspeita_fraude: 'Suspeita de fraude',
  documentacao_invalida: 'Documentação inválida',
  duplicidade: 'Cadastro duplicado',
  reativacao_apos_revisao: 'Reativação após revisão',
  outro: 'Outro',
};

export const AdminAssociadosTab: React.FC<AdminAssociadosTabProps> = ({ associados, registros, lotes, onRefreshData }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFiliacao | 'todos'>('todos');
  const [documentosStatus, setDocumentosStatus] = useState<Record<string, StatusDocumentos>>({});
  const [unmaskedCpf, setUnmaskedCpf] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [baixandoDoc, setBaixandoDoc] = useState<string | null>(null);

  const [detalhesId, setDetalhesId] = useState<string | null>(null);
  const [showBloqueioModal, setShowBloqueioModal] = useState(false);
  const [bloqueioMotivo, setBloqueioMotivo] = useState('solicitacao_associado');
  const [bloqueioObs, setBloqueioObs] = useState('');
  const [isSalvandoBloqueio, setIsSalvandoBloqueio] = useState(false);
  const [bloqueioError, setBloqueioError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/documentos/status')
      .then((res) => (res.ok ? res.json() : {}))
      .then(setDocumentosStatus)
      .catch(() => setDocumentosStatus({}));
  }, []);

  // Revelação sob clique, com auditoria no servidor (I6) — clicar de novo só
  // esconde de volta na tela, não desfaz o registro de auditoria já gravado.
  const handleRevealCpf = async (associadoId: string) => {
    if (unmaskedCpf[associadoId]) {
      setUnmaskedCpf((prev) => {
        const next = { ...prev };
        delete next[associadoId];
        return next;
      });
      return;
    }
    setRevealingId(associadoId);
    try {
      const res = await fetch(`/api/associados/${associadoId}/reveal-cpf`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao revelar documento.');
      setUnmaskedCpf((prev) => ({ ...prev, [associadoId]: data.cpf_cnpj_raw }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao revelar documento.');
    } finally {
      setRevealingId(null);
    }
  };

  const handleAbrirDocumento = async (associadoId: string, tipo: keyof StatusDocumentos) => {
    const chave = `${associadoId}:${tipo}`;
    setBaixandoDoc(chave);
    try {
      const res = await fetch(`/api/associados/${associadoId}/documentos/${tipo}/download`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Documento não encontrado.');
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao abrir documento.');
    } finally {
      setBaixandoDoc(null);
    }
  };

  const handleAbrirBloqueioModal = () => {
    setBloqueioMotivo('solicitacao_associado');
    setBloqueioObs('');
    setBloqueioError(null);
    setShowBloqueioModal(true);
  };

  const handleConfirmarBloqueio = async (associadoId: string, novoStatus: 'ativo' | 'inativo') => {
    setIsSalvandoBloqueio(true);
    setBloqueioError(null);
    try {
      const res = await fetch(`/api/associados/${associadoId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus, reasonCode: bloqueioMotivo, observacao: bloqueioObs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar acesso.');
      setShowBloqueioModal(false);
      onRefreshData();
    } catch (err) {
      setBloqueioError(err instanceof Error ? err.message : 'Erro ao atualizar acesso.');
    } finally {
      setIsSalvandoBloqueio(false);
    }
  };

  // Dashboard: contagem por status de filiação
  const totalAtivos = associados.filter((a) => a.status_filiacao === 'ativo').length;
  const totalInativos = associados.filter((a) => a.status_filiacao === 'inativo').length;
  const totalEmProcesso = associados.filter((a) =>
    ['pre_cadastro', 'ficha_enviada', 'ficha_assinada'].includes(a.status_filiacao),
  ).length;

  const filtered = associados.filter((a) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        (a.nome || '').toLowerCase().includes(q) ||
        (a.cpf_cnpj || '').toLowerCase().includes(q) ||
        (a.telefone_whatsapp || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (statusFilter !== 'todos' && a.status_filiacao !== statusFilter) return false;
    return true;
  });

  const registrosDoAssociado = (associadoId: string) => registros.filter((r) => r.associado_id === associadoId);

  // ==========================================
  // PÁGINA DETALHADA DE UM ASSOCIADO
  // ==========================================
  if (detalhesId) {
    const associado = associados.find((a) => a.id === detalhesId);
    if (!associado) {
      setDetalhesId(null);
      return null;
    }
    const status = documentosStatus[associado.id];
    const esperados = documentosEsperados(associado.tipo_documento);
    const registrosDele = registrosDoAssociado(associado.id);
    const statusCfg = STATUS_FILIACAO_LABEL[associado.status_filiacao];

    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setDetalhesId(null)}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Associados
        </button>

        {/* Cabeçalho + dados cadastrais completos */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${statusCfg.classes}`}
                >
                  {statusCfg.label}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                  {associado.tipo_documento === 'cnpj' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1.5">{associado.nome}</h2>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {associado.status_filiacao === 'inativo' ? (
                <button
                  type="button"
                  onClick={handleAbrirBloqueioModal}
                  className="px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Reativar Acesso
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAbrirBloqueioModal}
                  className="px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ShieldOff className="w-4 h-4" />
                  Bloquear Acesso
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 uppercase font-bold">CPF / CNPJ</p>
              <p className="font-mono text-xs font-bold text-slate-800 mt-0.5 flex items-center gap-1.5">
                {unmaskedCpf[associado.id] || associado.cpf_cnpj}
                <button
                  type="button"
                  onClick={() => handleRevealCpf(associado.id)}
                  disabled={revealingId === associado.id}
                  title={unmaskedCpf[associado.id] ? 'Ocultar' : 'Revelar CPF/CNPJ'}
                  className="text-slate-400 hover:text-[#148296] cursor-pointer disabled:opacity-50"
                >
                  {unmaskedCpf[associado.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Telefone (WhatsApp)</p>
              <p className="text-xs font-bold text-slate-800 mt-0.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {associado.telefone_whatsapp || 'não informado'}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 uppercase font-bold">E-mail</p>
              <p className="text-xs font-bold text-slate-800 mt-0.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {associado.email || '—'}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Filiado em</p>
              <p className="text-xs font-bold text-slate-800 mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {associado.filiado_em ? new Date(associado.filiado_em).toLocaleDateString('pt-BR') : '—'}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Consentimento LGPD (ficha)</p>
              <p className="text-[11px] font-semibold text-slate-700 mt-0.5">
                {associado.consentimento_em ? new Date(associado.consentimento_em).toLocaleString('pt-BR') : 'Não registrado'}
              </p>
              {associado.consentimento_ip && (
                <p className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  IP: {associado.consentimento_ip}
                </p>
              )}
              {associado.consentimento_hash && (
                <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate" title={associado.consentimento_hash}>
                  Hash: {associado.consentimento_hash.slice(0, 16)}…
                </p>
              )}
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Cadastrado em</p>
              <p className="text-xs font-bold text-slate-800 mt-0.5">
                {new Date(associado.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>

          {/* Documentos anexados */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-700 mb-2">Documentos Anexados</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {esperados.map((doc) => {
                const disponivel = Boolean(status?.[doc.tipo]);
                const chave = `${associado.id}:${doc.tipo}`;
                return (
                  <button
                    key={doc.tipo}
                    type="button"
                    disabled={!disponivel || baixandoDoc === chave}
                    onClick={() => handleAbrirDocumento(associado.id, doc.tipo)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                      disponivel
                        ? 'bg-white border border-[#148296]/30 text-[#148296] hover:bg-[#148296]/5'
                        : 'bg-slate-50 border border-slate-200 text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    <span>{doc.label}</span>
                    {disponivel ? <ExternalLink className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Todas as listas que ele enviou */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Listas Enviadas</h3>
            <span className="text-[11px] font-bold text-slate-500">{registrosDele.length} registro(s)</span>
          </div>
          {registrosDele.length === 0 ? (
            <p className="px-6 py-10 text-center text-xs text-slate-400">
              Este associado ainda não entrou em nenhuma Ação Coletiva.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {registrosDele.map((reg) => {
                const lote = lotes.find((l) => l.id === reg.lote_id);
                return (
                  <div key={reg.id} className="px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{lote?.nome || 'Ação Coletiva'}</p>
                      <p className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {reg.protocol_code || '—'} · {new Date(reg.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <StatusBadge status={reg.process_status} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* MODAL: Bloquear/Reativar acesso */}
        {showBloqueioModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  {associado.status_filiacao === 'inativo' ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <ShieldOff className="w-4 h-4 text-rose-600" />
                  )}
                  {associado.status_filiacao === 'inativo' ? 'Reativar Acesso' : 'Bloquear Acesso'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowBloqueioModal(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600">
                {associado.status_filiacao === 'inativo'
                  ? `Reativar o acesso de ${associado.nome} (volta para "Ativo").`
                  : `Bloquear o acesso de ${associado.nome} (associado passa a "Inativo").`}
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Motivo</label>
                  <select
                    value={bloqueioMotivo}
                    onChange={(e) => setBloqueioMotivo(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30 text-slate-800"
                  >
                    {Object.entries(MOTIVO_BLOQUEIO_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Observação (opcional)</label>
                  <textarea
                    rows={3}
                    value={bloqueioObs}
                    onChange={(e) => setBloqueioObs(e.target.value)}
                    placeholder="Detalhes adicionais sobre o motivo..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30 text-slate-800"
                  />
                </div>

                {bloqueioError && (
                  <div className="flex items-center gap-2 text-left bg-rose-50 text-rose-700 p-3 rounded-xl border border-rose-200 text-xs">
                    <X className="w-4 h-4 shrink-0" />
                    <span>{bloqueioError}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBloqueioModal(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSalvandoBloqueio}
                  onClick={() =>
                    handleConfirmarBloqueio(associado.id, associado.status_filiacao === 'inativo' ? 'ativo' : 'inativo')
                  }
                  className={`px-4 py-1.5 text-xs font-bold text-white rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    associado.status_filiacao === 'inativo'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isSalvandoBloqueio ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // LISTA (DASHBOARD + CARDS)
  // ==========================================
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-[#148296]" />
          Associados
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Todos os associados filiados à ABDCM, independente de estar em algum lote — CPF/CNPJ mascarado por
          padrão, revelação registrada em auditoria (I6)
        </p>
      </div>

      {/* Dashboard: contagem por status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#148296]/10 text-[#148296] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-900">{associados.length}</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold">Total</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-emerald-700">{totalAtivos}</p>
            <p className="text-[10px] text-emerald-600 uppercase font-bold">Ativos</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-zinc-100 text-zinc-500 flex items-center justify-center shrink-0">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-zinc-700">{totalInativos}</p>
            <p className="text-[10px] text-zinc-500 uppercase font-bold">Inativos</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-amber-700">{totalEmProcesso}</p>
            <p className="text-[10px] text-amber-600 uppercase font-bold">Em processo de filiação</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF/CNPJ ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFiliacao | 'todos')}
          className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none text-slate-700 font-medium cursor-pointer"
        >
          <option value="todos">Todos os status de filiação</option>
          {(Object.keys(STATUS_FILIACAO_LABEL) as StatusFiliacao[]).map((value) => (
            <option key={value} value={value}>
              {STATUS_FILIACAO_LABEL[value].label}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-slate-500">
        {filtered.length} de {associados.length} associado(s)
      </p>

      {filtered.length === 0 ? (
        <div className="bg-white p-10 rounded-xl border border-slate-200 shadow-2xs text-center text-xs text-slate-400">
          Nenhum associado encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => {
            const statusCfg = STATUS_FILIACAO_LABEL[a.status_filiacao];
            const totalRegistros = registrosDoAssociado(a.id).length;

            return (
              <div key={a.id} className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{a.nome}</p>
                    <p className="text-[11px] font-mono text-slate-500 mt-0.5">{a.cpf_cnpj}</p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusCfg.classes}`}
                  >
                    {statusCfg.label}
                  </span>
                </div>

                <div className="space-y-1 text-[11px] text-slate-600">
                  <p className="flex items-center gap-1.5 truncate">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {a.telefone_whatsapp || 'não informado'}
                  </p>
                  {a.email && (
                    <p className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {a.email}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setDetalhesId(a.id)}
                  className="mt-1 w-full pt-2.5 border-t border-slate-100 flex items-center justify-center gap-1.5 text-xs font-bold text-[#148296] hover:text-[#0f6b7c] cursor-pointer transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {`Detalhes (${totalRegistros} lista${totalRegistros === 1 ? '' : 's'})`}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
