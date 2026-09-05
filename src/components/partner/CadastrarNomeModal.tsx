import React, { useState } from 'react';
import { X, UserPlus, Check } from 'lucide-react';

interface CadastrarNomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (novo: { nome: string; cpf_cnpj: string; telefone_whatsapp?: string }) => void;
}

export const CadastrarNomeModal: React.FC<CadastrarNomeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [nome, setNome] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !cpfCnpj.trim()) {
      setError('Preencha o nome e o CPF/CNPJ.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/registros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          cpf_cnpj: cpfCnpj.trim(),
          telefone_whatsapp: whatsapp.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao cadastrar nome');
      }

      const created = await res.json();
      setNome('');
      setCpfCnpj('');
      setWhatsapp('');
      onSuccess(created);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#148296]/10 text-[#148296] flex items-center justify-center font-bold">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Cadastrar Nome</h3>
              <p className="text-[11px] text-slate-500">Adicionar à AÇÃO COLETIVA 124</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome Completo / Razão Social <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Carlos Alberto da Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              CPF ou CNPJ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              WhatsApp (Opcional)
            </label>
            <input
              type="text"
              placeholder="(11) 98765-4321"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none font-mono"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-sm cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {loading ? 'Cadastrando...' : 'Cadastrar Nome'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
