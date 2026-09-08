import React, { useEffect, useRef, useState } from 'react';
import { EventoNoticia } from '../../domain/types.js';
import { Calendar, Plus, Trash2, X, ImagePlus, Newspaper, Radio } from 'lucide-react';

const emptyForm = {
  tipo: 'evento' as 'evento' | 'noticia',
  titulo: '',
  descricao: '',
  categoria: '',
  imagemUrl: '',
  linkExterno: '',
  dataEvento: '',
};

const lerArquivoComoDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Erro ao ler a imagem.'));
    reader.readAsDataURL(file);
  });

export const AdminEventosTab: React.FC = () => {
  const [itens, setItens] = useState<EventoNoticia[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const imagemInputRef = useRef<HTMLInputElement>(null);

  const loadItens = () => {
    fetch('/api/eventos-noticias')
      // anúncios são publicados e geridos pela aba Serviços > Marketing, não aqui.
      .then((res) => (res.ok ? res.json() : []))
      .then((data: EventoNoticia[]) => setItens(data.filter((i) => i.tipo !== 'anuncio')))
      .catch(() => setItens([]));
  };

  useEffect(() => {
    loadItens();
  }, []);

  const handleImagemSelecionada = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await lerArquivoComoDataUrl(file);
      setForm((f) => ({ ...f, imagemUrl: dataUrl }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao ler a imagem.');
    }
  };

  const handleCriar = async () => {
    setFormError(null);
    if (!form.titulo.trim()) {
      setFormError('Título é obrigatório.');
      return;
    }
    if (!form.descricao.trim()) {
      setFormError('Descrição é obrigatória.');
      return;
    }
    if (!form.categoria.trim()) {
      setFormError('Categoria é obrigatória (ex.: "Live", "Novo Serviço", "Comunicado").');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/eventos-noticias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: form.tipo,
          titulo: form.titulo.trim(),
          descricao: form.descricao.trim(),
          categoria: form.categoria.trim(),
          imagemUrl: form.imagemUrl || undefined,
          linkExterno: form.linkExterno || undefined,
          dataEvento: form.tipo === 'evento' && form.dataEvento ? new Date(form.dataEvento).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao publicar');
      setForm(emptyForm);
      setShowForm(false);
      loadItens();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao publicar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAtivo = async (item: EventoNoticia) => {
    await fetch(`/api/eventos-noticias/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !item.ativo }),
    });
    loadItens();
  };

  const handleRemover = async (item: EventoNoticia) => {
    if (!confirm(`Remover "${item.titulo}"? Ele deixa de aparecer pro parceiro.`)) return;
    try {
      const res = await fetch(`/api/eventos-noticias/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao remover');
      loadItens();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#148296]" />
          <h2 className="text-lg font-bold text-slate-900">Eventos e Notícias</h2>
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
          Publicar
        </button>
      </div>
      <p className="text-xs text-slate-500 -mt-4">
        Controle o que os parceiros veem na aba Eventos: lives, novos serviços, comunicados e
        notícias relacionadas às listas.
      </p>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
        {showForm && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            {formError && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                {formError}
              </div>
            )}

            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 w-fit">
              <button
                type="button"
                onClick={() => setForm({ ...form, tipo: 'evento' })}
                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  form.tipo === 'evento' ? 'bg-[#148296] text-white' : 'text-slate-500'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                Evento
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, tipo: 'noticia' })}
                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  form.tipo === 'noticia' ? 'bg-[#148296] text-white' : 'text-slate-500'
                }`}
              >
                <Newspaper className="w-3.5 h-3.5" />
                Notícia
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Título</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder={form.tipo === 'evento' ? 'Ex: Live tira-dúvidas da Ação 125' : 'Ex: Novo prazo de reprotocolo'}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Categoria</label>
                <input
                  type="text"
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  placeholder='Ex: "Live", "Novo Serviço", "Comunicado"'
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descrição</label>
              <textarea
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              {form.tipo === 'evento' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data e hora</label>
                  <input
                    type="datetime-local"
                    value={form.dataEvento}
                    onChange={(e) => setForm({ ...form, dataEvento: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30"
                  />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Link (opcional — Zoom, WhatsApp etc.)
                </label>
                <input
                  type="text"
                  value={form.linkExterno}
                  onChange={(e) => setForm({ ...form, linkExterno: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Imagem de capa</label>
              <div className="flex items-center gap-2">
                {form.imagemUrl && (
                  <img src={form.imagemUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0" />
                )}
                <button
                  type="button"
                  onClick={() => imagemInputRef.current?.click()}
                  className="px-3 py-2 text-xs font-bold text-[#148296] bg-white hover:bg-slate-100 border border-[#148296]/40 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  {form.imagemUrl ? 'Trocar imagem' : 'Anexar imagem'}
                </button>
                <input ref={imagemInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagemSelecionada} />
              </div>
            </div>

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
                onClick={handleCriar}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Publicando...' : 'Publicar'}
              </button>
            </div>
          </div>
        )}

        {itens.length === 0 ? (
          <div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg p-3.5 text-center">
            Nada publicado ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {itens.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  {item.imagem_url ? (
                    <img src={item.imagem_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[#148296]/10 text-[#148296] flex items-center justify-center shrink-0">
                      {item.tipo === 'evento' ? <Radio className="w-4 h-4" /> : <Newspaper className="w-4 h-4" />}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-200 text-slate-600 shrink-0">
                        {item.categoria}
                      </span>
                      <p className="text-xs font-bold text-slate-900 truncate">{item.titulo}</p>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{item.descricao}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleAtivo(item)}
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                      item.ativo
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {item.ativo ? 'Publicado' : 'Oculto'}
                  </button>
                  <button
                    type="button"
                    title="Remover"
                    onClick={() => handleRemover(item)}
                    className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
