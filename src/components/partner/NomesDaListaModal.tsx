import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Registro,
  Lote,
  RegistroOrgaoStatus,
  NadaConstaEmissao,
  ORGAOS_BUREAU,
  ORGAO_BUREAU_LABEL,
  OrgaoBureau,
} from '../../domain/types.js';
import { StatusDocumentos, documentosEsperados } from '../../lib/documentos/index.js';
import { X, Calendar, FileText, ExternalLink, ShieldCheck, Loader2, BadgeCheck } from 'lucide-react';

interface ListaEnviada {
  id: string;
  lote_id: string;
  nomes_count: number;
  valor_total: number;
  payment_status: string;
  submetido_em: string;
}

interface NomesDaListaModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissao: ListaEnviada | null;
  lote: Lote | undefined;
  registros: Registro[];
  faseLabel: { label: string; classes: string };
  documentosStatus: Record<string, StatusDocumentos>;
  statusOrgaos: Record<string, RegistroOrgaoStatus[]>;
  nadaConsta: Record<string, NadaConstaEmissao>;
  onAbrirDocumento: (associadoId: string, tipo: keyof StatusDocumentos) => void;
  baixandoDoc: string | null;
}

export const NomesDaListaModal: React.FC<NomesDaListaModalProps> = ({
  isOpen,
  onClose,
  submissao,
  lote,
  registros,
  faseLabel,
  documentosStatus,
  statusOrgaos,
  nadaConsta,
  onAbrirDocumento,
  baixandoDoc,
}) => {
  if (!submissao) return null;

  const protocoloRef = lote?.referencia_protocolo || lote?.numero_processo || '—';
  const formattedDate = new Date(submissao.submetido_em).toLocaleDateString('pt-BR');

  // Órgão baixado no nível da lista = baixado pra TODOS os registros protocolados dela.
  const orgaoBaixadoParaTodos = (orgao: OrgaoBureau): boolean => {
    const protocolados = registros.filter((r) => statusOrgaos[r.id]);
    if (protocolados.length === 0) return false;
    return protocolados.every((r) => statusOrgaos[r.id]?.find((o) => o.orgao === orgao)?.status === 'baixado');
  };

  const proximoOrgaoPendente = ORGAOS_BUREAU.find((o) => !orgaoBaixadoParaTodos(o));

  const handleAbrirNadaConsta = (registroId: string) => {
    const emissao = nadaConsta[registroId];
    if (!emissao) return;
    // atob() devolve os bytes originais como uma "binary string" (1 char =
    // 1 byte) — como o HTML foi gerado em UTF-8, precisa passar por
    // TextDecoder pra não quebrar acentos. Chrome bloqueia navegação
    // direta pra data: URL via window.open, então abre em branco e escreve
    // o HTML já decodificado certo.
    const bytes = Uint8Array.from(atob(emissao.documento_base64), (c) => c.charCodeAt(0));
    const html = new TextDecoder('utf-8').decode(bytes);
    const janela = window.open();
    if (janela) {
      janela.document.write(html);
      janela.document.close();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900 truncate">{lote?.nome || 'Ação Coletiva'}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                  <span className="font-mono">{protocoloRef}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formattedDate}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${faseLabel.classes}`}>
                    {faseLabel.label}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Órgãos contemplados */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 shrink-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                Órgãos contemplados nesta ação
              </p>
              <div className="grid grid-cols-5 gap-2">
                {ORGAOS_BUREAU.map((orgao) => {
                  const baixado = orgaoBaixadoParaTodos(orgao);
                  const aguardando = !baixado && orgao === proximoOrgaoPendente;
                  return (
                    <div key={orgao} className="flex flex-col items-center gap-1.5">
                      <motion.div
                        animate={aguardando ? { scale: [1, 1.08, 1] } : {}}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                        className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-colors duration-700 ${
                          baixado
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : aguardando
                            ? 'bg-amber-50 border-amber-300 text-amber-500'
                            : 'bg-slate-100 border-slate-200 text-slate-300'
                        }`}
                      >
                        <ShieldCheck className="w-5 h-5" />
                      </motion.div>
                      <span className={`text-[9px] font-bold text-center leading-tight ${baixado ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {ORGAO_BUREAU_LABEL[orgao]}
                      </span>
                      {aguardando && (
                        <span className="text-[8px] text-amber-600 font-semibold flex items-center gap-0.5">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          aguardando
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lista de nomes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {registros.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Nenhum nome encontrado nesta lista.</p>
              ) : (
                registros.map((reg) => {
                  const statusDocs = documentosStatus[reg.associado_id];
                  const esperados = documentosEsperados(reg.tipo_documento);
                  const emissaoNadaConsta = nadaConsta[reg.id];

                  return (
                    <div key={reg.id} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{reg.nome}</p>
                          <p className="text-[10px] font-mono text-slate-500">{reg.cpf_cnpj}</p>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 flex items-center gap-1 shrink-0">
                          <FileText className="w-2.5 h-2.5" />
                          {reg.protocol_code || '—'}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {esperados.map((doc) => {
                          const disponivel = Boolean(statusDocs?.[doc.tipo]);
                          const chave = `${reg.associado_id}:${doc.tipo}`;
                          return (
                            <button
                              key={doc.tipo}
                              type="button"
                              disabled={!disponivel || baixandoDoc === chave}
                              onClick={() => onAbrirDocumento(reg.associado_id, doc.tipo)}
                              className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                                disponivel
                                  ? 'bg-white border border-[#148296]/30 text-[#148296] hover:bg-[#148296]/5'
                                  : 'bg-white border border-slate-200 text-slate-300 cursor-not-allowed'
                              }`}
                            >
                              {doc.label}
                              {disponivel && <ExternalLink className="w-2.5 h-2.5" />}
                            </button>
                          );
                        })}

                        {emissaoNadaConsta && (
                          <motion.button
                            type="button"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            onClick={() => handleAbrirNadaConsta(reg.id)}
                            className="px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1"
                          >
                            <BadgeCheck className="w-2.5 h-2.5" />
                            Nada Consta
                          </motion.button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
