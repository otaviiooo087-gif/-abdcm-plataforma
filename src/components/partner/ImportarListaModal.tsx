import React, { useState, useRef } from 'react';
import { X, UploadCloud, Download, CheckCircle2, AlertCircle, Upload, Loader2, XCircle, Sparkles, RefreshCw } from 'lucide-react';
import { stageArquivo } from '../../lib/documentos/index.js';

interface LinhaImportacao {
  nome: string;
  cpfCnpj: string;
  status: 'ok' | 'error';
  erro?: string;
}

interface ArquivoDoc {
  id: string;
  file: File;
}

interface DocOcrItemApi {
  key: string;
  nomeArquivo: string;
  tipoDetectado: 'cnh' | 'rg' | 'ficha_associativa' | null;
  ocrNome: string | null;
  ocrCpf: string | null;
  confianca: 'alta' | 'baixa';
  linhaCpfCnpjSugerida: string | null;
  autoConfirmavel: boolean;
}

interface DocOcrItemLocal extends DocOcrItemApi {
  mimeType: string;
  linhaCpfCnpjEscolhida: string | null;
  tipoEscolhido: 'cnh' | 'rg' | 'ficha_associativa' | null;
  incluir: boolean;
}

interface ImportarListaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  nomeLoteVigente?: string;
}

const CONCORRENCIA_UPLOAD = 4;
const TAMANHO_MAX_PLANILHA = 5 * 1024 * 1024;

function formatarCpfCnpj(digits: string): string {
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return digits;
}

export const ImportarListaModal: React.FC<ImportarListaModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  nomeLoteVigente,
}) => {
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nomeArquivoPlanilha, setNomeArquivoPlanilha] = useState<string | null>(null);
  const [carregandoPlanilha, setCarregandoPlanilha] = useState(false);
  const [linhas, setLinhas] = useState<LinhaImportacao[]>([]);
  const [ignoradas, setIgnoradas] = useState(0);

  const [arquivosDoc, setArquivosDoc] = useState<ArquivoDoc[]>([]);
  const [docItens, setDocItens] = useState<DocOcrItemLocal[]>([]);
  const [falhasStagingDocs, setFalhasStagingDocs] = useState<string[]>([]);
  const [lendoDocumentos, setLendoDocumentos] = useState(false);
  const [progressoDocs, setProgressoDocs] = useState({ feitos: 0, total: 0 });
  const [mensagemDocs, setMensagemDocs] = useState('');

  const [importando, setImportando] = useState(false);
  const [sucessoCount, setSucessoCount] = useState(0);
  const [sucessoDocsCount, setSucessoDocsCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  if (!isOpen) return null;

  const resetar = () => {
    setConcluido(false);
    setErro(null);
    setNomeArquivoPlanilha(null);
    setCarregandoPlanilha(false);
    setLinhas([]);
    setIgnoradas(0);
    setArquivosDoc([]);
    setDocItens([]);
    setFalhasStagingDocs([]);
    setLendoDocumentos(false);
    setProgressoDocs({ feitos: 0, total: 0 });
    setMensagemDocs('');
    setImportando(false);
    setSucessoCount(0);
    setSucessoDocsCount(0);
  };

  const handleClose = () => {
    resetar();
    onClose();
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Nome,CPF_CNPJ\n' +
      'Adilma Silva Dos Santos Guedes,308.915.798-50\n' +
      'MARIA HELENA DE OLIVEIRA,33.796.124/0001-84\n' +
      'NILSON ZANETONI PRADO,15.737.085/0001-62\n';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'modelo_importacao_limpa_nome.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processarPlanilha = async (file: File) => {
    if (file.size > TAMANHO_MAX_PLANILHA) {
      setErro('Arquivo maior que 5MB. Reduza a planilha e tente novamente.');
      return;
    }
    setErro(null);
    setCarregandoPlanilha(true);
    setNomeArquivoPlanilha(file.name);
    setLinhas([]);
    setIgnoradas(0);

    try {
      const staged = await stageArquivo(file);
      const res = await fetch('/api/registros/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staged),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao conferir a planilha');

      if (!data.linhas || data.linhas.length === 0) {
        setErro('Nenhuma linha válida encontrada na planilha.');
        setNomeArquivoPlanilha(null);
        return;
      }

      setLinhas(data.linhas);
      setIgnoradas(data.ignoradas || 0);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao conferir a planilha');
      setNomeArquivoPlanilha(null);
    } finally {
      setCarregandoPlanilha(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) processarPlanilha(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processarPlanilha(file);
  };

  const linhasOk = linhas.filter((l) => l.status === 'ok');
  const linhasComErro = linhas.filter((l) => l.status === 'error');

  // --- Documentos (CNH/RG/ficha associativa) casados por CPF ---

  const handleArquivosDocSelecionados = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: FileList | null = e.target.files;
    if (!files || files.length === 0) {
      e.target.value = '';
      return;
    }
    const novos: ArquivoDoc[] = Array.from(files).map((file, i) => ({ id: `${Date.now()}-${i}-${file.name}`, file }));
    e.target.value = '';
    setArquivosDoc((prev) => [...prev, ...novos]);
  };

  const handleRemoverArquivoDoc = (id: string) => {
    setArquivosDoc((prev) => prev.filter((a) => a.id !== id));
  };

  const handleLerDocumentosAutomaticamente = async () => {
    if (arquivosDoc.length === 0 || linhasOk.length === 0) return;
    setErro(null);
    setLendoDocumentos(true);
    setMensagemDocs('Enviando os documentos...');
    setProgressoDocs({ feitos: 0, total: arquivosDoc.length });

    const itensStaged: { key: string; mimeType: string; nomeArquivo: string }[] = [];
    const porKey = new Map<string, { mimeType: string; nomeArquivo: string }>();
    const falhasLocais: string[] = [];
    let feitos = 0;

    const fila = [...arquivosDoc];
    const worker = async () => {
      while (fila.length > 0) {
        const item = fila.shift();
        if (!item) return;
        try {
          const staged = await stageArquivo(item.file);
          itensStaged.push(staged);
          porKey.set(staged.key, { mimeType: staged.mimeType, nomeArquivo: staged.nomeArquivo });
        } catch (err) {
          falhasLocais.push(`${item.file.name}: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
        } finally {
          feitos++;
          setProgressoDocs({ feitos, total: arquivosDoc.length });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCORRENCIA_UPLOAD, arquivosDoc.length) }, () => worker()));

    if (itensStaged.length === 0) {
      setErro(`Nenhum documento pôde ser enviado. ${falhasLocais.join(' ')}`);
      setLendoDocumentos(false);
      return;
    }

    setMensagemDocs('Lendo os documentos com IA...');
    try {
      const res = await fetch('/api/registros/import/ocr-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: itensStaged, linhas: linhasOk.map((l) => ({ nome: l.nome, cpfCnpj: l.cpfCnpj })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao ler os documentos');

      setFalhasStagingDocs(falhasLocais);
      setDocItens((prev) => [
        ...prev,
        ...(data as DocOcrItemApi[]).map((item) => ({
          ...item,
          mimeType: porKey.get(item.key)?.mimeType || 'application/octet-stream',
          linhaCpfCnpjEscolhida: item.linhaCpfCnpjSugerida,
          tipoEscolhido: item.tipoDetectado,
          incluir: item.autoConfirmavel,
        })),
      ]);
      setArquivosDoc([]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao ler os documentos');
    } finally {
      setLendoDocumentos(false);
    }
  };

  const handleToggleIncluirDoc = (key: string) => {
    setDocItens((prev) => prev.map((it) => (it.key === key ? { ...it, incluir: !it.incluir } : it)));
  };

  const handleEscolherLinhaDoc = (key: string, cpfCnpj: string) => {
    setDocItens((prev) =>
      prev.map((it) =>
        it.key === key
          ? { ...it, linhaCpfCnpjEscolhida: cpfCnpj || null, incluir: Boolean(cpfCnpj) && Boolean(it.tipoEscolhido) }
          : it,
      ),
    );
  };

  const handleEscolherTipoDoc = (key: string, tipo: 'cnh' | 'rg' | 'ficha_associativa') => {
    setDocItens((prev) =>
      prev.map((it) => (it.key === key ? { ...it, tipoEscolhido: tipo, incluir: Boolean(it.linhaCpfCnpjEscolhida) } : it)),
    );
  };

  const docItensParaEnviar = docItens.filter((d) => d.incluir && d.linhaCpfCnpjEscolhida && d.tipoEscolhido);

  const docsPorLinha = (cpfCnpj: string) =>
    docItensParaEnviar.filter((d) => d.linhaCpfCnpjEscolhida === cpfCnpj).map((d) => d.tipoEscolhido);

  const handleConfirmarImport = async () => {
    setImportando(true);
    setErro(null);

    try {
      const payload = linhasOk.map((l) => ({
        nome: l.nome,
        cpf_cnpj: l.cpfCnpj,
        documentos: docItensParaEnviar
          .filter((d) => d.linhaCpfCnpjEscolhida === l.cpfCnpj)
          .map((d) => ({ tipo: d.tipoEscolhido, key: d.key, mimeType: d.mimeType, nomeArquivo: d.nomeArquivo })),
      }));

      const res = await fetch('/api/registros/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao importar a lista');

      setSucessoCount(data.count || 0);
      setSucessoDocsCount(docItensParaEnviar.length);
      setConcluido(true);
      onSuccess();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao importar a lista');
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-slate-900">Importar Lista em Massa</h3>
            {linhas.length > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {linhasOk.length} válidos
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Card Lista Ativa */}
          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#dc2626] text-white tracking-wide uppercase mb-1">
                Lista Ativa
              </span>
              <h4 className="text-sm font-bold text-slate-900">{nomeLoteVigente || 'AÇÃO COLETIVA 124'}</h4>
              <p className="text-xs text-slate-500">Os nomes serão importados para esta lista</p>
            </div>
          </div>

          {erro && (
            <div className="flex items-center gap-2 text-left bg-rose-50 text-rose-700 p-3 rounded-xl border border-rose-200 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{erro}</span>
            </div>
          )}

          {concluido ? (
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-200 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {sucessoCount} nome(s) importado(s) com sucesso
              {sucessoDocsCount > 0 ? `, com ${sucessoDocsCount} documento(s) anexado(s).` : '.'}
            </div>
          ) : (
            <>
              {/* Planilha */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Arquivo da Planilha
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    dragActive
                      ? 'border-[#148296] bg-[#148296]/5'
                      : 'border-[#99d9e2] bg-[#f0f9fa] hover:bg-[#e6f6f8]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {carregandoPlanilha ? (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <Loader2 className="w-6 h-6 animate-spin text-[#148296]" />
                      <p className="text-xs font-bold text-slate-700">Lendo {nomeArquivoPlanilha}...</p>
                    </div>
                  ) : nomeArquivoPlanilha && linhas.length > 0 ? (
                    <div className="flex flex-col items-center gap-1.5 py-1">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      <p className="text-xs font-bold text-slate-800">{nomeArquivoPlanilha}</p>
                      <p className="text-[11px] text-slate-500">
                        {linhasOk.length} válidos
                        {linhasComErro.length > 0 ? ` · ${linhasComErro.length} com problema` : ''} — clique pra trocar
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 mx-auto rounded-full bg-white shadow-xs flex items-center justify-center text-[#148296] mb-3">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-slate-800 mb-0.5">
                        Clique para selecionar ou arraste aqui
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Formatos aceitos: .xlsx, .csv (máx. 5MB)
                      </p>
                    </>
                  )}
                </div>
              </div>

              {linhas.length === 0 && !carregandoPlanilha && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 text-xs text-slate-600 space-y-1">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-[#148296]" />
                    Formato esperado:
                  </p>
                  <p>• Coluna A: Nome/Razão Social</p>
                  <p>• Coluna B: CPF/CNPJ (com ou sem máscara)</p>
                  <p>• Linha 1 será ignorada (cabeçalho)</p>
                </div>
              )}

              {linhas.length > 0 && (
                <div className="space-y-2">
                  {linhasComErro.length > 0 && (
                    <p className="text-[11px] text-rose-600 font-semibold">
                      {linhasComErro.length} linha(s) com problema não serão importadas (veja abaixo).
                    </p>
                  )}
                  {ignoradas > 0 && (
                    <p className="text-[11px] text-slate-400">{ignoradas} linha(s) em branco foram ignoradas.</p>
                  )}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-bold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5">Nome</th>
                          <th className="px-4 py-2.5">CPF/CNPJ</th>
                          <th className="px-4 py-2.5">Documentos</th>
                          <th className="px-4 py-2.5 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {linhas.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="px-4 py-2.5 font-medium">{item.nome}</td>
                            <td className="px-4 py-2.5 font-mono text-slate-600">{formatarCpfCnpj(item.cpfCnpj)}</td>
                            <td className="px-4 py-2.5 font-mono text-[10px] text-[#148296]">
                              {item.status === 'ok' && docsPorLinha(item.cpfCnpj).length > 0
                                ? docsPorLinha(item.cpfCnpj)
                                    .map((t) => (t === 'ficha_associativa' ? 'FICHA' : t?.toUpperCase()))
                                    .join(' + ')
                                : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {item.status === 'ok' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> OK
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600" title={item.erro}>
                                  <XCircle className="w-3.5 h-3.5" /> {item.erro}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Documentos — sempre visível, não depende da planilha já ter sido lida */}
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <div>
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#148296]" />
                    Documentos (CNH, RG e Ficha Associativa) — opcional
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Anexe de uma vez os documentos de quem está sendo importado — o sistema lê nome e
                    CPF de cada um e casa automaticamente com a linha certa da planilha. Confira antes
                    de importar.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  className="w-full py-5 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:border-[#148296] hover:text-[#148296] hover:bg-[#148296]/5 cursor-pointer transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-xs font-bold">Selecionar documentos (fotos, PDF, CNH, RG e ficha juntos)</span>
                </button>
                <input
                  ref={docInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={handleArquivosDocSelecionados}
                />

                {arquivosDoc.length > 0 && (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-32 overflow-y-auto">
                    {arquivosDoc.map((a) => (
                      <div key={a.id} className="px-3 py-2 flex items-center justify-between text-xs">
                        <span className="truncate text-slate-700">{a.file.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoverArquivoDoc(a.id)}
                          className="text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="px-3 py-2 space-y-1">
                      <button
                        type="button"
                        onClick={handleLerDocumentosAutomaticamente}
                        disabled={linhasOk.length === 0 || lendoDocumentos}
                        className="w-full py-1.5 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Ler {arquivosDoc.length} Documento(s) Automaticamente
                      </button>
                      {linhasOk.length === 0 && (
                        <p className="text-[10px] text-slate-400 text-center">Envie a planilha primeiro pra poder casar os documentos.</p>
                      )}
                    </div>
                  </div>
                )}

                {lendoDocumentos && (
                  <div className="flex flex-col items-center gap-2 py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-[#148296]" />
                    <p className="text-xs font-semibold text-slate-600">{mensagemDocs}</p>
                    {progressoDocs.total > 0 && (
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-[#148296] h-1.5 rounded-full transition-all"
                          style={{ width: `${(progressoDocs.feitos / progressoDocs.total) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {falhasStagingDocs.length > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 max-h-24 overflow-y-auto space-y-1">
                    <p className="text-[11px] font-bold text-rose-800">
                      {falhasStagingDocs.length} arquivo(s) não puderam ser enviados:
                    </p>
                    {falhasStagingDocs.map((f, i) => (
                      <p key={i} className="text-[11px] text-rose-700">{f}</p>
                    ))}
                  </div>
                )}

                {docItens.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {docItens.map((item) => (
                      <div
                        key={item.key}
                        className={`border rounded-xl p-3 text-xs space-y-2 ${
                          item.incluir ? 'border-[#148296]/30 bg-[#148296]/5' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 truncate">{item.nomeArquivo}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              lido: {item.ocrNome || '—'}
                              {item.ocrCpf ? ` · CPF ${item.ocrCpf}` : ''}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.confianca === 'alta' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {item.confianca === 'alta' ? 'confiança alta' : 'confiança baixa'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={item.incluir}
                            disabled={!item.linhaCpfCnpjEscolhida || !item.tipoEscolhido}
                            onChange={() => handleToggleIncluirDoc(item.key)}
                            className="shrink-0"
                          />
                          <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0">
                            {(['cnh', 'rg', 'ficha_associativa'] as const).map((tipo) => (
                              <button
                                key={tipo}
                                type="button"
                                onClick={() => handleEscolherTipoDoc(item.key, tipo)}
                                className={`px-2 py-1.5 text-[10px] font-bold cursor-pointer transition-colors ${
                                  item.tipoEscolhido === tipo ? 'bg-[#148296] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                                }`}
                              >
                                {tipo === 'ficha_associativa' ? 'FICHA' : tipo.toUpperCase()}
                              </button>
                            ))}
                          </div>
                          <select
                            value={item.linhaCpfCnpjEscolhida || ''}
                            onChange={(e) => handleEscolherLinhaDoc(item.key, e.target.value)}
                            className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white cursor-pointer"
                          >
                            <option value="">— selecionar linha da planilha —</option>
                            {linhasOk.map((l) => (
                              <option key={l.cpfCnpj} value={l.cpfCnpj}>
                                {l.nome} — {formatarCpfCnpj(l.cpfCnpj)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="text-xs font-semibold text-[#148296] hover:text-[#0f6b7c] flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar Modelo
          </button>

          <div className="flex items-center gap-2">
            {!concluido && linhas.length > 0 && (
              <button
                type="button"
                onClick={resetar}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Recomeçar
              </button>
            )}
            {!concluido && (
              <button
                type="button"
                onClick={handleConfirmarImport}
                disabled={linhasOk.length === 0 || importando}
                className="px-5 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {importando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {importando ? 'Importando...' : `Importar ${linhasOk.length} Nome(s)`}
              </button>
            )}
            {concluido && (
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs cursor-pointer transition-colors"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
