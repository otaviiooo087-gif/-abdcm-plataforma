import React, { useEffect, useState } from 'react';
import { Lote } from '../../domain/types.js';
import { Pencil, X } from 'lucide-react';

interface EditarLoteModalProps {
  lote: Lote | null;
  onClose: () => void;
  onSalvo: () => void;
}

function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const EditarLoteModal: React.FC<EditarLoteModalProps> = ({ lote, onClose, onSalvo }) => {
  const [form, setForm] = useState({
    nome: '',
    numeroProcesso: '',
    varaTribunal: '',
    juiz: '',
    referenciaProtocolo: '',
    dataProtocolo: '',
    dataDistribuicao: '',
    liminarStatus: '',
    closesAt: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lote) return;
    setForm({
      nome: lote.nome,
      numeroProcesso: lote.numero_processo || '',
      varaTribunal: lote.vara_tribunal || '',
      juiz: lote.juiz || '',
      referenciaProtocolo: lote.referencia_protocolo || '',
      dataProtocolo: toDatetimeLocalValue(lote.data_protocolo),
      dataDistribuicao: lote.data_distribuicao || '',
      liminarStatus: lote.liminar_status || '',
      closesAt: toDatetimeLocalValue(lote.closes_at),
    });
    setError(null);
  }, [lote?.id]);

  if (!lote) return null;

  const handleSalvar = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/lotes/${lote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          numeroProcesso: form.numeroProcesso,
          varaTribunal: form.varaTribunal,
          juiz: form.juiz,
          referenciaProtocolo: form.referenciaProtocolo,
          dataProtocolo: form.dataProtocolo ? new Date(form.dataProtocolo).toISOString() : '',
          dataDistribuicao: form.dataDistribuicao,
          liminarStatus: form.liminarStatus,
          closesAt: form.closesAt ? new Date(form.closesAt).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      onSalvo();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const campo = (label: string, chave: keyof typeof form, placeholder?: string, tipo = 'text') => (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</label>
      <input
        type={tipo}
        value={form[chave]}
        onChange={(e) => setForm({ ...form, [chave]: e.target.value })}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30 text-slate-800"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Pencil className="w-4 h-4 text-[#148296]" />
            Editar Ação Coletiva
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">{error}</div>
        )}

        <div className="space-y-3">
          {campo('Nome da Ação Coletiva', 'nome')}
          <div className="grid grid-cols-2 gap-3">
            {campo('Número do Processo', 'numeroProcesso', '1024567-89.2026.4.03.6100')}
            {campo('Referência de Protocolo', 'referenciaProtocolo', '2026.888.10124')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {campo('Vara / Tribunal', 'varaTribunal', '1ª Vara Cível Federal')}
            {campo('Juiz', 'juiz')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {campo('Data do Protocolo', 'dataProtocolo', undefined, 'datetime-local')}
            {campo('Prazo de Encerramento', 'closesAt', undefined, 'datetime-local')}
          </div>
          {campo('Data de Distribuição', 'dataDistribuicao', 'Prevista para 11/09/2026')}
          {campo('Status da Liminar', 'liminarStatus', 'Em captação e conciliação de nomes')}
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSalvar}
            className="px-4 py-1.5 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
};
