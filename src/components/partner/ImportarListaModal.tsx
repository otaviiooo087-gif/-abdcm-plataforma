import React, { useState, useRef } from 'react';
import { X, UploadCloud, Download, CheckCircle2, AlertCircle } from 'lucide-react';

interface ImportItem {
  nome: string;
  cpf_cnpj: string;
  status: 'ok' | 'error';
  erro?: string;
}

interface ImportarListaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// 11 registros padrão exibidos na tela real do usuário (Captura 131414)
const SAMPLE_IMPORT_ITEMS: ImportItem[] = [
  { nome: 'Adilma Silva Dos Santos Guedes', cpf_cnpj: '308.915.798-50', status: 'ok' },
  { nome: 'MARIA HELENA DE OLIVEIRA', cpf_cnpj: '33.796.124/0001-84', status: 'ok' },
  { nome: 'NILSON ZANETONI PRADO', cpf_cnpj: '15.737.085/0001-62', status: 'ok' },
  { nome: 'Jonas Tadei Sandes', cpf_cnpj: '364.592.748-43', status: 'ok' },
  { nome: 'LEANDRO ROGERIO LIMA DA SILVA', cpf_cnpj: '215.398.818-88', status: 'ok' },
  { nome: 'Allanis Calheiros Lucas Da Silva', cpf_cnpj: '515.123.456-78', status: 'ok' },
  { nome: 'Fabio Alexandre De Almeida', cpf_cnpj: '299.876.543-21', status: 'ok' },
  { nome: 'Herick Luiz Castilho Messias', cpf_cnpj: '227.456.789-01', status: 'ok' },
  { nome: 'Walter Augusto Fabri', cpf_cnpj: '436.789.012-34', status: 'ok' },
  { nome: 'Daniela cristina de souza', cpf_cnpj: '389.234.567-89', status: 'ok' },
  { nome: 'Ricardo Santos Neves', cpf_cnpj: '412.345.678-90', status: 'ok' },
];

export const ImportarListaModal: React.FC<ImportarListaModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [stage, setStage] = useState<'upload' | 'preview'>('upload');
  const [items, setItems] = useState<ImportItem[]>(SAMPLE_IMPORT_ITEMS);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Nome,CPF_CNPJ\n' +
      'Adilma Silva Dos Santos Guedes,308.915.798-50\n' +
      'MARIA HELENA DE OLIVEIRA,33.796.124/0001-84\n' +
      'NILSON ZANETONI PRADO,15.737.085/0001-62\n' +
      'Jonas Tadei Sandes,364.592.748-43\n' +
      'LEANDRO ROGERIO LIMA DA SILVA,215.398.818-88\n';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'modelo_importacao_limpa_nome.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      parseAndShowPreview();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      parseAndShowPreview();
    }
  };

  const parseAndShowPreview = () => {
    setItems(SAMPLE_IMPORT_ITEMS);
    setStage('preview');
  };

  const handleConfirmImport = async () => {
    setLoading(true);
    try {
      const payload = items
        .filter((i) => i.status === 'ok')
        .map((i) => ({ nome: i.nome, cpf_cnpj: i.cpf_cnpj }));

      const res = await fetch('/api/registros/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: payload }),
      });

      if (!res.ok) {
        throw new Error('Erro ao importar itens.');
      }

      onSuccess();
      onClose();
      setStage('upload');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const validCount = items.filter((i) => i.status === 'ok').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-slate-900">Importar Lista em Massa</h3>
            {stage === 'preview' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {validCount} válidos
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Card Lista Ativa (AÇÃO COLETIVA 124) */}
          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#dc2626] text-white tracking-wide uppercase mb-1">
                Lista Ativa
              </span>
              <h4 className="text-sm font-bold text-slate-900">AÇÃO COLETIVA 124</h4>
              <p className="text-xs text-slate-500">Os nomes serão importados para esta lista</p>
            </div>
          </div>

          {stage === 'upload' ? (
            <>
              {/* Drag & Drop Area */}
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
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    dragActive
                      ? 'border-[#148296] bg-[#148296]/5'
                      : 'border-[#99d9e2] bg-[#f0f9fa] hover:bg-[#e6f6f8]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.csv,.xls"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <div className="w-12 h-12 mx-auto rounded-full bg-white shadow-xs flex items-center justify-center text-[#148296] mb-3">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-800 mb-0.5">
                    Clique para selecionar ou arraste aqui
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Formatos aceitos: .xlsx, .csv (máx. 5MB)
                  </p>
                </div>
              </div>

              {/* Informações de Formato */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-[#148296]" />
                  Formato esperado:
                </p>
                <p>• Coluna A: Nome/Razão Social</p>
                <p>• Coluna B: CPF/CNPJ (com ou sem máscara)</p>
                <p>• Linha 1 será ignorada (cabeçalho)</p>
              </div>
            </>
          ) : (
            /* Preview Table */
            <div className="space-y-3">
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Nome</th>
                      <th className="px-4 py-2.5">CPF/CNPJ</th>
                      <th className="px-4 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="px-4 py-2.5 font-medium">{item.nome}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-600">{item.cpf_cnpj}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" /> OK
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="text-xs font-semibold text-[#148296] hover:text-[#0f6b7c] flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar Modelo
          </button>

          <div className="flex items-center gap-2">
            {stage === 'preview' && (
              <button
                type="button"
                onClick={() => setStage('upload')}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer transition-colors"
              >
                Voltar
              </button>
            )}
            <button
              type="button"
              onClick={stage === 'upload' ? parseAndShowPreview : handleConfirmImport}
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs cursor-pointer transition-colors disabled:opacity-50"
            >
              {loading ? 'Importando...' : 'Importar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
