import React, { useEffect, useState } from 'react';
import { Registro, RegistroOrgaoStatus, ORGAOS_BUREAU, ORGAO_BUREAU_LABEL, OrgaoBureau } from '../../domain/types.js';
import { X, ShieldCheck, Loader2, PartyPopper } from 'lucide-react';

interface OrgaosBaixaModalProps {
  registro: Registro | null;
  onClose: () => void;
  onRefreshData: () => void;
}

export const OrgaosBaixaModal: React.FC<OrgaosBaixaModalProps> = ({ registro, onClose, onRefreshData }) => {
  const [orgaos, setOrgaos] = useState<RegistroOrgaoStatus[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [marcandoOrgao, setMarcandoOrgao] = useState<OrgaoBureau | null>(null);
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    if (!registro) return;
    setConcluido(false);
    setCarregando(true);
    fetch('/api/registro-orgaos')
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: Record<string, RegistroOrgaoStatus[]>) => setOrgaos(data[registro.id] || []))
      .catch(() => setOrgaos([]))
      .finally(() => setCarregando(false));
  }, [registro?.id]);

  if (!registro) return null;

  const handleMarcarBaixado = async (orgao: OrgaoBureau) => {
    setMarcandoOrgao(orgao);
    try {
      const res = await fetch(`/api/registros/${registro.id}/orgaos/${orgao}/baixar`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao registrar baixa');
      setOrgaos(data.orgaos);
      if (data.registroFoiBaixado) {
        setConcluido(true);
        onRefreshData();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao registrar baixa');
    } finally {
      setMarcandoOrgao(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Baixa por Órgão</h4>
            <p className="text-xs text-slate-500 mt-0.5">{registro.nome} — {registro.protocol_code || registro.id}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {concluido && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-700 flex items-center gap-2">
            <PartyPopper className="w-4 h-4 shrink-0" />
            Todos os órgãos deram baixa — registro concluído e nada consta emitido automaticamente.
          </div>
        )}

        {carregando ? (
          <div className="py-8 text-center text-xs text-slate-400">Carregando...</div>
        ) : orgaos.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Este registro ainda não tem status por órgão (precisa estar protocolado).
          </div>
        ) : (
          <div className="space-y-2">
            {ORGAOS_BUREAU.map((orgao) => {
              const status = orgaos.find((o) => o.orgao === orgao);
              const baixado = status?.status === 'baixado';
              return (
                <div
                  key={orgao}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border ${
                    baixado ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={`w-4 h-4 ${baixado ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <span className="text-xs font-bold text-slate-800">{ORGAO_BUREAU_LABEL[orgao]}</span>
                  </div>
                  {baixado ? (
                    <span className="text-[10px] font-bold text-emerald-700 uppercase">Baixado</span>
                  ) : (
                    <button
                      type="button"
                      disabled={marcandoOrgao === orgao}
                      onClick={() => handleMarcarBaixado(orgao)}
                      className="px-2.5 py-1 text-[10px] font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-md cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    >
                      {marcandoOrgao === orgao && <Loader2 className="w-3 h-3 animate-spin" />}
                      Marcar Baixado
                    </button>
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
