import React, { useState, useEffect } from 'react';
import { Associado, Registro, StatusFiliacao } from '../../domain/types.js';
import { StatusDocumentos, documentosEsperados } from '../../lib/documentos/index.js';
import { Users, Search, Eye, EyeOff, ExternalLink, X, Phone, Mail } from 'lucide-react';

interface AdminAssociadosTabProps {
  associados: Associado[];
  registros: Registro[];
}

const STATUS_FILIACAO_LABEL: Record<StatusFiliacao, { label: string; classes: string }> = {
  pre_cadastro: { label: 'Pré-cadastro', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  ficha_enviada: { label: 'Ficha Enviada', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  ficha_assinada: { label: 'Ficha Assinada', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  ativo: { label: 'Ativo', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  inativo: { label: 'Inativo', classes: 'bg-zinc-100 text-zinc-600 border-zinc-300' },
};

export const AdminAssociadosTab: React.FC<AdminAssociadosTabProps> = ({ associados, registros }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFiliacao | 'todos'>('todos');
  const [documentosStatus, setDocumentosStatus] = useState<Record<string, StatusDocumentos>>({});
  const [unmaskedCpf, setUnmaskedCpf] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [docsAbertoParaAssociado, setDocsAbertoParaAssociado] = useState<string | null>(null);
  const [baixandoDoc, setBaixandoDoc] = useState<string | null>(null);

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

  const contarRegistros = (associadoId: string) => registros.filter((r) => r.associado_id === associadoId).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold shrink-0">
          {associados.length} associado(s)
        </span>
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-xs text-slate-400">Nenhum associado encontrado.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((a) => {
              const status = documentosStatus[a.id];
              const esperados = documentosEsperados(a.tipo_documento);
              const docsAbertos = docsAbertoParaAssociado === a.id;
              const totalRegistros = contarRegistros(a.id);
              const statusCfg = STATUS_FILIACAO_LABEL[a.status_filiacao];

              return (
                <div key={a.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{a.nome}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 font-mono">
                          {unmaskedCpf[a.id] || a.cpf_cnpj}
                          <button
                            type="button"
                            onClick={() => handleRevealCpf(a.id)}
                            disabled={revealingId === a.id}
                            title={unmaskedCpf[a.id] ? 'Ocultar' : 'Revelar CPF/CNPJ'}
                            className="text-slate-400 hover:text-[#148296] cursor-pointer disabled:opacity-50"
                          >
                            {unmaskedCpf[a.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {a.telefone_whatsapp}
                        </span>
                        {a.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {a.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-bold text-slate-500">{totalRegistros} lote(s)</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusCfg.classes}`}
                      >
                        {statusCfg.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDocsAbertoParaAssociado(docsAbertos ? null : a.id)}
                        title="Ver documentos anexados"
                        className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                          docsAbertos
                            ? 'bg-[#148296]/10 text-[#148296]'
                            : 'text-slate-400 hover:text-[#148296] hover:bg-[#148296]/10'
                        }`}
                      >
                        {docsAbertos ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {docsAbertos && (
                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      {esperados.map((doc) => {
                        const disponivel = Boolean(status?.[doc.tipo]);
                        const chave = `${a.id}:${doc.tipo}`;
                        return (
                          <button
                            key={doc.tipo}
                            type="button"
                            disabled={!disponivel || baixandoDoc === chave}
                            onClick={() => handleAbrirDocumento(a.id, doc.tipo)}
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
