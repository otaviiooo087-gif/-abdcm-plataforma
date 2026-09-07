import React, { useRef, useState } from 'react';
import { X, FolderUp, FileCheck2, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface AnexarDocumentosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConcluido: () => void;
}

interface PreviewItem {
  cpf_cnpj_raw: string;
  associado_id: string | null;
  nome: string | null;
  ja_tem_cnh: boolean;
  ja_tem_rg: boolean;
}

interface ArquivoEncontrado {
  cpf: string;
  tipo: 'cnh' | 'rg';
  file: File;
}

type Etapa = 'selecionar' | 'conferindo' | 'preview' | 'enviando' | 'resumo';

const CONCORRENCIA_UPLOAD = 4;

// Agrupa os arquivos de uma pasta selecionada em <cpf>/<cnh|rg>.<ext> —
// aceita qualquer profundidade de subpasta, usa o primeiro segmento do
// caminho como CPF/CNPJ e o nome do arquivo (sem extensão) pra achar o tipo.
function agruparArquivos(fileList: FileList): { encontrados: ArquivoEncontrado[]; ignorados: number } {
  const encontrados: ArquivoEncontrado[] = [];
  let ignorados = 0;

  for (const file of Array.from(fileList)) {
    const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const partes = relPath.split('/');
    if (partes.length < 2) {
      ignorados++;
      continue;
    }
    const cpf = partes[0].replace(/\D/g, '');
    const nomeBase = (partes[partes.length - 1].split('.')[0] || '').toLowerCase();
    const tipo: 'cnh' | 'rg' | null = nomeBase.includes('cnh') ? 'cnh' : nomeBase.includes('rg') ? 'rg' : null;

    if (!cpf || !tipo) {
      ignorados++;
      continue;
    }
    encontrados.push({ cpf, tipo, file });
  }

  return { encontrados, ignorados };
}

export const AnexarDocumentosModal: React.FC<AnexarDocumentosModalProps> = ({ isOpen, onClose, onConcluido }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<Etapa>('selecionar');
  const [arquivos, setArquivos] = useState<ArquivoEncontrado[]>([]);
  const [ignorados, setIgnorados] = useState(0);
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });
  const [falhas, setFalhas] = useState<string[]>([]);
  const [sucesso, setSucesso] = useState(0);

  if (!isOpen) return null;

  const resetar = () => {
    setEtapa('selecionar');
    setArquivos([]);
    setIgnorados(0);
    setPreview([]);
    setErro(null);
    setProgresso({ feitos: 0, total: 0 });
    setFalhas([]);
    setSucesso(0);
  };

  const handleClose = () => {
    resetar();
    onClose();
  };

  const handlePastaSelecionada = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = '';
    if (!files || files.length === 0) return;

    const { encontrados, ignorados: qtdIgnorados } = agruparArquivos(files);
    if (encontrados.length === 0) {
      setErro('Nenhum arquivo "cnh" ou "rg" encontrado dentro de subpastas nomeadas com o CPF/CNPJ.');
      return;
    }

    setArquivos(encontrados);
    setIgnorados(qtdIgnorados);
    setEtapa('conferindo');
    setErro(null);

    try {
      const cpfsUnicos = [...new Set(encontrados.map((a) => a.cpf))];
      const res = await fetch('/api/documentos/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpfsCnpjs: cpfsUnicos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao conferir documentos');
      setPreview(data);
      setEtapa('preview');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao conferir documentos');
      setEtapa('selecionar');
    }
  };

  const encontradosPorCpf = new Map<string, PreviewItem>(preview.map((p) => [p.cpf_cnpj_raw, p]));
  const casados = arquivos.filter((a) => encontradosPorCpf.get(a.cpf)?.associado_id);
  const naoEncontrados = [...new Set(arquivos.filter((a) => !encontradosPorCpf.get(a.cpf)?.associado_id).map((a) => a.cpf))];

  const handleConfirmarEnvio = async () => {
    setEtapa('enviando');
    setProgresso({ feitos: 0, total: casados.length });
    const falhasLocais: string[] = [];
    let feitos = 0;
    let sucessoLocal = 0;

    const fila = [...casados];
    const worker = async () => {
      while (fila.length > 0) {
        const item = fila.shift();
        if (!item) return;
        const associadoId = encontradosPorCpf.get(item.cpf)!.associado_id!;
        try {
          const presignRes = await fetch('/api/documentos/presign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ associadoId, tipo: item.tipo, mimeType: item.file.type || 'application/octet-stream' }),
          });
          const presignData = await presignRes.json();
          if (!presignRes.ok) throw new Error(presignData.error || 'Falha ao autorizar upload');

          const uploadRes = await fetch(presignData.uploadUrl, {
            method: 'PUT',
            headers: presignData.headers || {},
            body: item.file,
          });
          if (!uploadRes.ok) throw new Error('Falha ao enviar o arquivo pro armazenamento');

          const confirmRes = await fetch('/api/documentos/confirmar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              associadoId,
              tipo: item.tipo,
              key: presignData.key,
              mimeType: item.file.type || 'application/octet-stream',
              nomeArquivo: item.file.name,
              tamanhoBytes: item.file.size,
            }),
          });
          const confirmData = await confirmRes.json();
          if (!confirmRes.ok) throw new Error(confirmData.error || 'Falha ao confirmar upload');

          sucessoLocal++;
        } catch (err) {
          falhasLocais.push(
            `${encontradosPorCpf.get(item.cpf)?.nome || item.cpf} (${item.tipo.toUpperCase()}): ${
              err instanceof Error ? err.message : 'erro desconhecido'
            }`,
          );
        } finally {
          feitos++;
          setProgresso({ feitos, total: casados.length });
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCORRENCIA_UPLOAD, casados.length) }, () => worker()));

    setFalhas(falhasLocais);
    setSucesso(sucessoLocal);
    setEtapa('resumo');
    onConcluido();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#148296]/10 text-[#148296] flex items-center justify-center font-bold">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Anexar Documentos (CNH/RG)</h3>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {etapa === 'selecionar' && (
            <>
              <p className="text-xs text-slate-600 leading-relaxed">
                Organize uma pasta com uma subpasta por CPF/CNPJ, e dentro dela os arquivos{' '}
                <strong>cnh.jpg</strong> e <strong>rg.jpg</strong> (ou .png/.pdf). Exemplo:
              </p>
              <pre className="text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-600 overflow-x-auto">
{`documentos/
  12345678900/
    cnh.jpg
    rg.jpg
  98765432100/
    cnh.jpg
    rg.jpg`}
              </pre>
              {erro && (
                <div className="flex items-center gap-2 text-left bg-rose-50 text-rose-700 p-3 rounded-xl border border-rose-200 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{erro}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-[#148296] hover:text-[#148296] hover:bg-[#148296]/5 cursor-pointer transition-colors"
              >
                <FolderUp className="w-8 h-8" />
                <span className="text-xs font-bold">Selecionar pasta com os documentos</span>
              </button>
              <input
                ref={inputRef}
                type="file"
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                onChange={handlePastaSelecionada}
              />
            </>
          )}

          {etapa === 'conferindo' && (
            <div className="flex flex-col items-center gap-3 py-8 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-[#148296]" />
              <p className="text-xs font-semibold">Conferindo CPFs contra a base de associados...</p>
            </div>
          )}

          {etapa === 'preview' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <p className="text-2xl font-black text-emerald-700">{casados.length}</p>
                  <p className="text-[11px] text-emerald-800 font-semibold">documento(s) serão anexados</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-2xl font-black text-amber-700">{naoEncontrados.length}</p>
                  <p className="text-[11px] text-amber-800 font-semibold">CPF/CNPJ sem cadastro na lista</p>
                </div>
              </div>

              {ignorados > 0 && (
                <p className="text-[11px] text-slate-400">
                  {ignorados} arquivo(s) da pasta foram ignorados (fora do padrão cnh/rg).
                </p>
              )}

              {naoEncontrados.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 max-h-32 overflow-y-auto">
                  <p className="text-[11px] font-bold text-amber-800 mb-1">Não encontrados (confira o CPF/CNPJ da pasta):</p>
                  <p className="text-[11px] font-mono text-amber-700">{naoEncontrados.join(', ')}</p>
                </div>
              )}

              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {Array.from(new Set(casados.map((a) => a.cpf))).map((cpf: string) => {
                  const item = encontradosPorCpf.get(cpf)!;
                  const tiposDesteCpf = casados.filter((a) => a.cpf === cpf).map((a) => a.tipo);
                  return (
                    <div key={cpf} className="px-3 py-2 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 truncate">{item.nome}</span>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">
                        {tiposDesteCpf.map((t) => t.toUpperCase()).join(' + ')}
                        {(item.ja_tem_cnh || item.ja_tem_rg) && ' · substitui existente'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {etapa === 'enviando' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#148296]" />
              <p className="text-xs font-semibold text-slate-600">
                Enviando {progresso.feitos} de {progresso.total}...
              </p>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#148296] h-2 rounded-full transition-all"
                  style={{ width: `${progresso.total ? (progresso.feitos / progresso.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {etapa === 'resumo' && (
            <>
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-200 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {sucesso} documento(s) anexado(s) com sucesso.
              </div>
              {falhas.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1">
                  <p className="text-[11px] font-bold text-rose-800 flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" /> {falhas.length} falharam:
                  </p>
                  {falhas.map((f, i) => (
                    <p key={i} className="text-[11px] text-rose-700">{f}</p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
          {etapa === 'preview' && (
            <>
              <button
                type="button"
                onClick={resetar}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer transition-colors"
              >
                Escolher outra pasta
              </button>
              <button
                type="button"
                disabled={casados.length === 0}
                onClick={handleConfirmarEnvio}
                className="px-5 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-sm cursor-pointer transition-colors disabled:opacity-50"
              >
                Confirmar e Enviar {casados.length} Documento(s)
              </button>
            </>
          )}
          {(etapa === 'selecionar' || etapa === 'resumo') && (
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-sm cursor-pointer transition-colors"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
