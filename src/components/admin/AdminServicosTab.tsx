import React, { useEffect, useState } from 'react';
import { Servico } from '../../domain/types.js';
import { formatCurrencyBRL } from '../../lib/money/index.js';
import { ShoppingBag, Plus, Trash2, X } from 'lucide-react';

const REASON_CODES: { value: string; label: string }[] = [
  { value: 'duplicado', label: 'Serviço duplicado' },
  { value: 'descontinuado', label: 'Serviço descontinuado' },
  { value: 'cadastrado_por_engano', label: 'Cadastrado por engano' },
  { value: 'outro', label: 'Outro motivo' },
];

const emptyForm = {
  nome: '',
  precoReais: '',
  prazoDias: '',
  usaListas: false,
};

export const AdminServicosTab: React.FC = () => {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Servico | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteObs, setDeleteObs] = useState('');

  const loadServicos = () => {
    fetch('/api/servicos')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Servico[]) => setServicos(data))
      .catch(() => setServicos([]));
  };

  useEffect(() => {
    loadServicos();
  }, []);

  const handleCreateServico = async () => {
    setFormError(null);
    const precoCentavos = Math.round(parseFloat(form.precoReais.replace(',', '.')) * 100);
    const prazo = parseInt(form.prazoDias, 10);
    if (!form.nome.trim()) {
      setFormError('Nome é obrigatório.');
      return;
    }
    if (!Number.isFinite(precoCentavos) || precoCentavos < 0) {
      setFormError('Preço inválido.');
      return;
    }
    if (!Number.isInteger(prazo) || prazo < 0) {
      setFormError('Prazo (em dias) inválido.');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/servicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome.trim(),
          preco: precoCentavos,
          prazoDias: prazo,
          usaListas: form.usaListas,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar serviço');
      setForm(emptyForm);
      setShowForm(false);
      loadServicos();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao cadastrar serviço');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAtivo = async (servico: Servico) => {
    await fetch(`/api/servicos/${servico.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !servico.ativo }),
    });
    loadServicos();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !deleteReason) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/servicos/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasonCode: deleteReason, observacao: deleteObs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao remover serviço');
      setDeleteTarget(null);
      setDeleteReason('');
      setDeleteObs('');
      loadServicos();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao remover serviço');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-[#148296]" />
          <h2 className="text-lg font-bold text-slate-900">Serviços</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            setFormError(null);
          }}
          className="px-3 py-1.5 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Novo Serviço
        </button>
      </div>
      <p className="text-xs text-slate-500 -mt-4">
        Catálogo de serviços que a ABDCM oferece — defina nome, preço, prazo e se ele funciona
        por listas (igual à Ação Coletiva Limpa Nome) ou como serviço único.
      </p>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
        {showForm && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            {formError && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                {formError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Ação Coletiva Limpa Nome"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Preço (R$)
                </label>
                <input
                  type="text"
                  value={form.precoReais}
                  onChange={(e) => setForm({ ...form, precoReais: e.target.value })}
                  placeholder="55,00"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Prazo (dias)
                </label>
                <input
                  type="text"
                  value={form.prazoDias}
                  onChange={(e) => setForm({ ...form, prazoDias: e.target.value })}
                  placeholder="60"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={form.usaListas}
                onChange={(e) => setForm({ ...form, usaListas: e.target.checked })}
                className="rounded border-slate-300 text-[#148296] focus:ring-[#148296] cursor-pointer"
              />
              Funciona por listas/lotes (igual à Ação Coletiva Limpa Nome)
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleCreateServico}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
              >
                Salvar Serviço
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Prazo</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {servicos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Nenhum serviço cadastrado ainda.
                  </td>
                </tr>
              ) : (
                servicos.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-semibold text-slate-900">{s.nome}</td>
                    <td className="px-4 py-3 font-bold">{formatCurrencyBRL(s.preco)}</td>
                    <td className="px-4 py-3">{s.prazo_dias} dias</td>
                    <td className="px-4 py-3">
                      {s.usa_listas ? 'Por listas' : 'Serviço único'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleAtivo(s)}
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                          s.ativo
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {s.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        title="Remover"
                        onClick={() => setDeleteTarget(s)}
                        className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de exclusão com reason_code (I11) */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">
                Remover "{deleteTarget.nome}"
              </h4>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Motivo
              </label>
              <select
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none cursor-pointer"
              >
                <option value="">Selecione...</option>
                {REASON_CODES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Observação
              </label>
              <textarea
                value={deleteObs}
                onChange={(e) => setDeleteObs(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!deleteReason || isSaving}
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
              >
                Confirmar Remoção
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
