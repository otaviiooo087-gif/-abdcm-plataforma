import React, { useEffect, useRef, useState } from 'react';
import { X, FileUp, Loader2, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Download } from 'lucide-react';
import { stageArquivo } from '../../lib/documentos/index.js';

interface CadastrarPorDocumentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (novo: { nome: string; cpf_cnpj: string }) => void;
}

type Etapa = 'upload' | 'lendo' | 'conferir' | 'gerando' | 'concluido';

/** Fluxo "só envia o documento": o parceiro sobe uma foto de RG/CNH, o
 * sistema lê nome e CPF com IA (I3: sempre revisável antes de gravar) e, ao
 * confirmar, cadastra o nome e já gera a ficha associativa assinada
 * automaticamente (com uma cópia visual da assinatura recortada da própria
 * foto) — sem o parceiro precisar preencher nada nem pedir assinatura à
 * parte. */
export const CadastrarPorDocumentoModal: React.FC<CadastrarPorDocumentoModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [etapa, setEtapa] = useState<Etapa>('upload');
  const [erro, setErro] = useState<string | null>(null);
  const [staged, setStaged] = useState<{ key: string; mimeType: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [confianca, setConfianca] = useState<'alta' | 'baixa' | null>(null);
  const [assinaturaDetectada, setAssinaturaDetectada] = useState(false);
  const [associadoId, setAssociadoId] = useState<string | null>(null);
  const [baixandoFicha, setBaixandoFicha] = useState(false);
  const [leituraAutomaticaAtiva, setLeituraAutomaticaAtiva] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sem OCR real configurado (ou sem Armazenamento real, que o OCR real
  // também exige), a leitura automática nunca vem — é o comportamento
  // padrão em modo simulação, não uma falha desta tentativa específica.
  // Avisa isso de cara em vez de deixar parecer que a leitura "não
  // funcionou" (ver Configurações > APIs no admin).
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/config/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setLeituraAutomaticaAtiva(Boolean(data?.ocr?.configurado && data?.storage?.configurado)))
      .catch(() => setLeituraAutomaticaAtiva(true));
  }, [isOpen]);

  if (!isOpen) return null;

  const resetar = () => {
    setEtapa('upload');
    setErro(null);
    setStaged(null);
    setPreviewUrl(null);
    setNome('');
    setCpfCnpj('');
    setConfianca(null);
    setAssinaturaDetectada(false);
  };

  const handleClose = () => {
    resetar();
    onClose();
  };

  const handleArquivo = async (file: File) => {
    setErro(null);
    setEtapa('lendo');
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const stagedDoc = await stageArquivo(file);
      setStaged(stagedDoc);

      const res = await fetch('/api/documentos/ocr/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: [stagedDoc] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao ler o documento');

      const item = data[0];
      if (!item) throw new Error('Não recebi leitura do documento.');

      setNome(item.ocrNome || '');
      setCpfCnpj(item.ocrCpf || '');
      setConfianca(item.confianca);
      setEtapa('conferir');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao ler o documento');
      setEtapa('upload');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) handleArquivo(file);
  };

  const handleConfirmar = async () => {
    if (!staged || !nome.trim() || !cpfCnpj.trim()) {
      setErro('Confira o nome e o CPF/CNPJ antes de continuar.');
      return;
    }
    setErro(null);
    setEtapa('gerando');

    try {
      const resRegistro = await fetch('/api/registros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), cpf_cnpj: cpfCnpj.trim() }),
      });
      const registro = await resRegistro.json();
      if (!resRegistro.ok) throw new Error(registro.error || 'Erro ao cadastrar nome');
      setAssociadoId(registro.associado_id);

      const resFicha = await fetch(`/api/associados/${registro.associado_id}/gerar-ficha-automatica`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: staged.key, mimeType: staged.mimeType }),
      });
      const ficha = await resFicha.json();
      if (!resFicha.ok) {
        // O nome já foi cadastrado — a ficha é um passo à parte, então uma
        // falha aqui não desfaz o cadastro, só avisa que precisa gerar a
        // ficha manualmente depois (anexando na ficha do associado).
        setErro(`Nome cadastrado, mas a ficha não pôde ser gerada automaticamente: ${ficha.error || 'erro desconhecido'}`);
        setEtapa('concluido');
        onSuccess(registro);
        return;
      }

      setAssinaturaDetectada(true);
      setEtapa('concluido');
      onSuccess(registro);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao cadastrar');
      setEtapa('conferir');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#148296]/10 text-[#148296] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Cadastrar por Documento</h3>
              <p className="text-[11px] text-slate-500">Envie o RG ou CNH — o resto é automático</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {erro && (
            <div className="flex items-center gap-2 text-left bg-rose-50 text-rose-700 p-3 rounded-xl border border-rose-200 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{erro}</span>
            </div>
          )}

          {etapa === 'upload' && (
            <label className="flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-[#148296] transition-all group">
              <div className="p-4 bg-slate-100 rounded-full mb-3 group-hover:bg-[#148296]/10 transition-colors">
                <FileUp className="w-8 h-8 text-slate-400 group-hover:text-[#148296] transition-colors" />
              </div>
              <p className="text-xs text-center px-6">
                <span className="font-bold text-[#148296]">Clique para enviar</span>
                <span className="text-slate-600"> o RG ou CNH (foto ou PDF)</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Nome, CPF e assinatura são preenchidos automaticamente</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          )}

          {etapa === 'lendo' && (
            <div className="flex flex-col items-center justify-center h-56 gap-3">
              <Loader2 className="w-10 h-10 text-[#148296] animate-spin" />
              <p className="text-xs font-bold text-slate-700">Lendo nome, CPF e assinatura com IA...</p>
            </div>
          )}

          {(etapa === 'conferir' || etapa === 'gerando') && (
            <div className="space-y-4">
              {previewUrl && (
                <img src={previewUrl} alt="Documento enviado" className="w-full max-h-40 object-contain rounded-lg border border-slate-200 bg-slate-50" />
              )}

              {!leituraAutomaticaAtiva ? (
                <div className="flex items-center gap-2 bg-slate-100 text-slate-600 p-2.5 rounded-lg border border-slate-200 text-[11px] font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Leitura automática ainda não configurada nesta conta — preencha nome e CPF abaixo.
                </div>
              ) : (
                confianca === 'baixa' && (
                  <div className="flex items-center gap-2 bg-amber-50 text-amber-700 p-2.5 rounded-lg border border-amber-200 text-[11px] font-semibold">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Confiança baixa na leitura — confira nome e CPF com atenção antes de confirmar.
                  </div>
                )
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  disabled={etapa === 'gerando'}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">CPF ou CNPJ</label>
                <input
                  type="text"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(e.target.value)}
                  disabled={etapa === 'gerando'}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none font-mono disabled:bg-slate-50"
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Ao confirmar, o sistema cadastra o nome e gera a ficha associativa (Termo de
                Autorização e Representação) já assinada, com data, IP e comprovante registrados.
              </p>
            </div>
          )}

          {etapa === 'concluido' && (
            <div className="flex flex-col items-center text-center gap-2 py-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="text-sm font-bold text-slate-900">{nome}</p>
              <p className="text-xs text-slate-500">Cadastrado e adicionado à Ação Coletiva vigente</p>
              {assinaturaDetectada && (
                <p className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 mt-1">
                  Ficha associativa gerada e assinada automaticamente
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
          {etapa === 'conferir' && (
            <>
              <button
                type="button"
                onClick={resetar}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Trocar arquivo
              </button>
              <button
                type="button"
                onClick={handleConfirmar}
                className="px-5 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Confirmar e Gerar Ficha
              </button>
            </>
          )}
          {etapa === 'gerando' && (
            <button type="button" disabled className="px-5 py-2 text-xs font-bold text-white bg-[#148296] rounded-lg opacity-70 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Gerando ficha assinada...
            </button>
          )}
          {etapa === 'concluido' && (
            <>
              {assinaturaDetectada && associadoId && (
                <button
                  type="button"
                  disabled={baixandoFicha}
                  onClick={async () => {
                    setBaixandoFicha(true);
                    try {
                      const res = await fetch(`/api/associados/${associadoId}/documentos/ficha_associativa/download`);
                      const data = await res.json();
                      if (res.ok && data.url) window.open(data.url, '_blank');
                    } finally {
                      setBaixandoFicha(false);
                    }
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-[#148296] hover:bg-[#148296]/10 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {baixandoFicha ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Baixar Ficha
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs cursor-pointer transition-colors"
              >
                Fechar
              </button>
            </>
          )}
          {(etapa === 'upload' || etapa === 'lendo') && (
            <button
              type="button"
              onClick={handleClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
