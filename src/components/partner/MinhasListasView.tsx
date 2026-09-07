import React, { useState } from 'react';
import { Registro, Lote } from '../../domain/types.js';
import { StatusDocumentos, documentosEsperados } from '../../lib/documentos/index.js';
import { formatCurrencyBRL } from '../../lib/money/index.js';
import { Download, Search, Calendar, Eye, EyeOff, FileText, ExternalLink, X } from 'lucide-react';

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
  documentosStatus: Record<string, StatusDocumentos>;
}

// Órgãos de proteção ao crédito — cada nome mostra os 5, "baixado" quando o
// registro já foi baixado, "pendente" enquanto isso não acontece (não temos
// status por órgão individualmente, só o agregado do registro).
const ORGAOS = ['Serasa', 'Boa Vista', 'SPC', 'Cenprot BR', 'Cenprot SP'];

// Fase do PROCESSO (jurídico/protocolo) da lista — diferente do status de
// pagamento, que já aparece na aba Enviar Limpa Nome. Pega a fase mais
// avançada entre os registros da lista; "Lista Concluída" só quando o
// próprio lote foi fechado pelo admin.
type FaseProcesso = 'cancelada' | 'recusado' | 'concluida' | 'fase2' | 'fase1' | 'em_processo' | 'inicial';

const FASE_LABEL: Record<FaseProcesso, { label: string; classes: string }> = {
  inicial: { label: 'Fase Inicial', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  em_processo: { label: 'Em Processo', classes: 'bg-sky-50 text-sky-700 border-sky-200' },
  fase1: { label: 'Fase 1 — Protocolada', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  fase2: { label: 'Fase 2 — Baixas Iniciadas', classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  concluida: { label: 'Lista Concluída', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  recusado: { label: 'Recusado pelo Birô', classes: 'bg-rose-50 text-rose-700 border-rose-200' },
  cancelada: { label: 'Cancelada', classes: 'bg-zinc-100 text-zinc-600 border-zinc-300' },
};

function calcularFase(sub: ListaEnviada, registrosDaLista: Registro[], lote: Lote | undefined): FaseProcesso {
  if (sub.payment_status === 'cancelado') return 'cancelada';
  if (registrosDaLista.some((r) => r.process_status === 'recusado')) return 'recusado';
  if (lote?.status === 'concluido') return 'concluida';
  if (registrosDaLista.some((r) => r.process_status === 'baixado')) return 'fase2';
  if (registrosDaLista.some((r) => r.process_status === 'protocolado')) return 'fase1';
  if (registrosDaLista.some((r) => r.process_status === 'pago' || r.process_status === 'aguardando_protocolo')) return 'em_processo';
  return 'inicial';
}

export const MinhasListasView: React.FC<MinhasListasViewProps> = ({ registros, lotes, submissoes, documentosStatus }) => {
  const [search, setSearch] = useState('');
  const [selectedLote, setSelectedLote] = useState('todos');
  const [selectedFase, setSelectedFase] = useState('todos');
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [docsAbertoParaRegistro, setDocsAbertoParaRegistro] = useState<string | null>(null);
  const [baixandoDoc, setBaixandoDoc] = useState<string | null>(null);

  const loteDaSubmissao = (sub: ListaEnviada) => lotes.find((l) => l.id === sub.lote_id);
  const registrosDaSubmissao = (subId: string) => registros.filter((r) => r.submissao_id === subId);

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
    if (selectedFase !== 'todos' && calcularFase(sub, registrosDaSubmissao(sub.id), lote) !== selectedFase) return false;
    if (dataDe && new Date(sub.submetido_em) < new Date(dataDe)) return false;
    if (dataAte && new Date(sub.submetido_em) > new Date(`${dataAte}T23:59:59`)) return false;
    return true;
  });

  const ordenadas = [...filtered].sort(
    (a, b) => new Date(b.submetido_em).getTime() - new Date(a.submetido_em).getTime(),
  );

  const handleExportExcel = () => {
    const headers = ['Lista', 'Numero_Protocolo', 'Nome', 'CPF_CNPJ', 'Status', 'Data_Envio'];

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

  const faseBadge = (fase: FaseProcesso) => {
    const config = FASE_LABEL[fase];
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${config.classes}`}>
        {config.label}
      </span>
    );
  };

  const getBureauPill = (baixado: boolean) =>
    baixado ? (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
        baixado
      </span>
    ) : (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase">
        pendente
      </span>
    );

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
          value={selectedFase}
          onChange={(e) => setSelectedFase(e.target.value)}
          className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none text-slate-700 font-medium cursor-pointer"
        >
          <option value="todos">Todas as fases</option>
          {(Object.keys(FASE_LABEL) as FaseProcesso[]).map((f) => (
            <option key={f} value={f}>
              {FASE_LABEL[f].label}
            </option>
          ))}
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
            const nomesDaLista = registrosDaSubmissao(sub.id);
            const isExpanded = expandedId === sub.id;
            const formattedDate = new Date(sub.submetido_em).toLocaleDateString('pt-BR');
            const fase = calcularFase(sub, nomesDaLista, lote);

            return (
              <div key={sub.id} className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{lote?.nome || 'Ação Coletiva'}</h4>
                    <p className="text-xs font-mono text-slate-500 mt-0.5 truncate">{protocolo}</p>
                  </div>
                  {faseBadge(fase)}
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
                  onClick={() => {
                    setExpandedId(isExpanded ? null : sub.id);
                    setDocsAbertoParaRegistro(null);
                  }}
                  className="w-full pt-2.5 border-t border-slate-100 flex items-center justify-center gap-1.5 text-xs font-bold text-[#148296] hover:text-[#0f6b7c] cursor-pointer transition-colors"
                >
                  {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {isExpanded ? 'Ocultar nomes' : 'Ver nomes anexados'}
                </button>

                {isExpanded && (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto -mx-1 px-1">
                    {nomesDaLista.length === 0 ? (
                      <p className="text-[11px] text-slate-400 text-center py-3">
                        Nenhum nome encontrado nesta lista.
                      </p>
                    ) : (
                      nomesDaLista.map((reg) => {
                        const baixado = reg.process_status === 'baixado';
                        const docsAbertos = docsAbertoParaRegistro === reg.id;
                        const statusDocs = documentosStatus[reg.associado_id];
                        const esperados = documentosEsperados(reg.tipo_documento);

                        return (
                          <div key={reg.id} className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">{reg.nome}</p>
                                <p className="text-[10px] font-mono text-slate-500">{reg.cpf_cnpj}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[9px] font-mono text-slate-400 flex items-center gap-1">
                                  <FileText className="w-2.5 h-2.5" />
                                  {reg.protocol_code || '—'}
                                </span>
                                <button
                                  type="button"
                                  title="Ver documentos do associado"
                                  onClick={() => setDocsAbertoParaRegistro(docsAbertos ? null : reg.id)}
                                  className={`p-1 rounded cursor-pointer transition-colors ${
                                    docsAbertos ? 'bg-[#148296]/10 text-[#148296]' : 'text-slate-400 hover:text-[#148296] hover:bg-[#148296]/10'
                                  }`}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="mt-2 grid grid-cols-5 gap-1 text-center">
                              {ORGAOS.map((orgao) => (
                                <div key={orgao} className="flex flex-col items-center gap-1">
                                  {getBureauPill(baixado)}
                                  <span className="text-[8px] text-slate-400 leading-tight">{orgao}</span>
                                </div>
                              ))}
                            </div>

                            {docsAbertos && (
                              <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                                {esperados.map((doc) => {
                                  const disponivel = Boolean(statusDocs?.[doc.tipo]);
                                  const chave = `${reg.associado_id}:${doc.tipo}`;
                                  return (
                                    <button
                                      key={doc.tipo}
                                      type="button"
                                      disabled={!disponivel || baixandoDoc === chave}
                                      onClick={() => handleAbrirDocumento(reg.associado_id, doc.tipo)}
                                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                                        disponivel
                                          ? 'bg-white border border-[#148296]/30 text-[#148296] hover:bg-[#148296]/5'
                                          : 'bg-white border border-slate-200 text-slate-300 cursor-not-allowed'
                                      }`}
                                    >
                                      <span>{doc.label}</span>
                                      {disponivel ? (
                                        <ExternalLink className="w-3 h-3" />
                                      ) : (
                                        <X className="w-3 h-3" />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
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
