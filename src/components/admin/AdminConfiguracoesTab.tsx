import React, { useEffect, useRef, useState } from 'react';
import { Contrato } from '../../domain/types.js';
import {
  Settings,
  FileSignature,
  UploadCloud,
  Download,
  CheckCircle,
  Plug,
  QrCode,
  MessageCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

type ConfigSubTab = 'geral' | 'apis';

interface StatusIntegracoes {
  pix: { provider: string; configurado: boolean };
  whatsapp: { provider: string; configurado: boolean };
}

export const AdminConfiguracoesTab: React.FC = () => {
  const [subTab, setSubTab] = useState<ConfigSubTab>('geral');
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [isUploadingContrato, setIsUploadingContrato] = useState(false);
  const [status, setStatus] = useState<StatusIntegracoes | null>(null);
  const contratoInputRef = useRef<HTMLInputElement>(null);

  const loadContrato = () => {
    fetch('/api/contrato')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Contrato | null) => setContrato(data))
      .catch(() => setContrato(null));
  };

  useEffect(() => {
    loadContrato();
    fetch('/api/config/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StatusIntegracoes | null) => setStatus(data))
      .catch(() => setStatus(null));
  }, []);

  const handleContratoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploadingContrato(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/contrato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomeArquivo: file.name,
          mimeType: file.type || 'application/pdf',
          conteudoBase64: base64,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao anexar contrato');
      setContrato(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao anexar contrato');
    } finally {
      setIsUploadingContrato(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-[#148296]" />
        <h2 className="text-lg font-bold text-slate-900">Configurações</h2>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setSubTab('geral')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px cursor-pointer transition-colors ${
            subTab === 'geral'
              ? 'border-[#148296] text-[#148296]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Geral
        </button>
        <button
          type="button"
          onClick={() => setSubTab('apis')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px cursor-pointer transition-colors flex items-center gap-1.5 ${
            subTab === 'apis'
              ? 'border-[#148296] text-[#148296]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Plug className="w-3.5 h-3.5" />
          APIs
        </button>
      </div>

      {subTab === 'geral' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4 max-w-2xl">
          <div className="flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-[#148296]" />
            <h3 className="text-sm font-bold text-slate-900">Contrato Limpa Nome</h3>
          </div>
          <p className="text-xs text-slate-500">
            Anexe o modelo de contrato que ficará disponível para os parceiros e associados
            consultarem e baixarem.
          </p>

          {contrato ? (
            <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3.5">
              <div className="flex items-center gap-2.5 text-emerald-900">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold">{contrato.nome_arquivo}</p>
                  <p className="text-[11px] text-emerald-700">
                    Atualizado em {new Date(contrato.atualizado_em).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <a
                href={`data:${contrato.mime_type};base64,${contrato.conteudo_base64}`}
                download={contrato.nome_arquivo}
                className="text-xs font-bold text-[#148296] hover:underline flex items-center gap-1 shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar
              </a>
            </div>
          ) : (
            <div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg p-3.5">
              Nenhum contrato anexado ainda.
            </div>
          )}

          <button
            type="button"
            disabled={isUploadingContrato}
            onClick={() => contratoInputRef.current?.click()}
            className="px-3.5 py-2 text-xs font-bold text-[#148296] bg-white hover:bg-slate-50 border border-[#148296]/40 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            {isUploadingContrato
              ? 'Enviando...'
              : contrato
              ? 'Substituir Contrato'
              : 'Anexar Contrato'}
          </button>
          <input
            ref={contratoInputRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={handleContratoSelected}
          />
        </div>
      )}

      {subTab === 'apis' && (
        <div className="space-y-4 max-w-2xl">
          <p className="text-xs text-slate-500">
            Chaves de API nunca ficam no código nem no banco — só em variável de ambiente
            (Railway → Variables), por segurança (invariante I10). Aqui você só confere se
            cada integração está ativa.
          </p>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#148296]/10 text-[#148296] flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">PIX — Asaas</p>
                <p className="text-[11px] text-slate-500">
                  Gera o QR Code automático na aba Enviar Lista. Variáveis: PIX_PROVIDER=real,
                  ASAAS_API_KEY, ASAAS_ENV.
                </p>
              </div>
            </div>
            {status?.pix.configurado ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Conectado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                <XCircle className="w-3.5 h-3.5" />
                Modo simulação
              </span>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#148296]/10 text-[#148296] flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">WhatsApp — Z-API</p>
                <p className="text-[11px] text-slate-500">
                  Envia os avisos automáticos da aba Automações. Variáveis:
                  WHATSAPP_PROVIDER=real, ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN.
                </p>
              </div>
            </div>
            {status?.whatsapp.configurado ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Conectado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                <XCircle className="w-3.5 h-3.5" />
                Modo simulação
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
