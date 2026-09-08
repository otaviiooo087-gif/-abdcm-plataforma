import React, { useEffect, useState } from 'react';
import { Servico, MarketingCronogramaDia, MarketingDisparo, MarketingGrupoConfig } from '../../domain/types.js';
import { Send, Megaphone, CalendarClock, Users2, History, FlaskConical, CheckCircle2 } from 'lucide-react';

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface AdminMarketingSubTabProps {
  servicos: Servico[];
}

const sugestaoMensagem = (servico: Servico): string =>
  `Aqui é da ABDCM! Passando pra te contar sobre o serviço "${servico.nome}"${
    servico.descricao ? `: ${servico.descricao}` : ''
  }. Quer saber mais? Fale com o parceiro que cuidou da sua filiação.`;

export const AdminMarketingSubTab: React.FC<AdminMarketingSubTabProps> = ({ servicos }) => {
  const [servicoId, setServicoId] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [isDisparando, setIsDisparando] = useState(false);
  const [isPublicandoAnuncio, setIsPublicandoAnuncio] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const [cronograma, setCronograma] = useState<MarketingCronogramaDia[]>([]);
  const [salvandoDia, setSalvandoDia] = useState<number | null>(null);

  const [grupoConfig, setGrupoConfig] = useState<MarketingGrupoConfig | null>(null);
  const [isSavingGrupo, setIsSavingGrupo] = useState(false);

  const [log, setLog] = useState<MarketingDisparo[]>([]);

  const load = () => {
    fetch('/api/marketing/cronograma')
      .then((res) => (res.ok ? res.json() : []))
      .then(setCronograma)
      .catch(() => setCronograma([]));
    fetch('/api/marketing/grupo-config')
      .then((res) => (res.ok ? res.json() : null))
      .then(setGrupoConfig)
      .catch(() => setGrupoConfig(null));
    fetch('/api/marketing/log')
      .then((res) => (res.ok ? res.json() : []))
      .then(setLog)
      .catch(() => setLog([]));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!servicoId) return;
    const servico = servicos.find((s) => s.id === servicoId);
    if (servico && !mensagem.trim()) setMensagem(sugestaoMensagem(servico));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicoId]);

  const servicoSelecionado = servicos.find((s) => s.id === servicoId) || null;

  const handleDisparar = async () => {
    if (!servicoId || !mensagem.trim()) return;
    setIsDisparando(true);
    setResultado(null);
    try {
      const res = await fetch('/api/marketing/disparo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servicoId, mensagem: mensagem.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao disparar');
      setResultado(`Disparado para ${data.enviados} associado(s)${data.falhas ? ` (${data.falhas} falha(s))` : ''}.`);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao disparar marketing');
    } finally {
      setIsDisparando(false);
    }
  };

  const handlePublicarAnuncio = async () => {
    if (!servicoSelecionado) return;
    setIsPublicandoAnuncio(true);
    try {
      const res = await fetch('/api/eventos-noticias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'anuncio',
          titulo: servicoSelecionado.nome,
          descricao: servicoSelecionado.descricao || 'Confira este serviço da ABDCM.',
          categoria: 'Publicidade',
          imagemUrl: servicoSelecionado.foto_url || undefined,
          linkExterno: servicoSelecionado.link_redirecionamento || undefined,
        }),
      });
      if (!res.ok) throw new Error('Erro ao publicar anúncio');
      alert('Anúncio publicado! Vai aparecer no topo da página inicial dos parceiros.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao publicar anúncio');
    } finally {
      setIsPublicandoAnuncio(false);
    }
  };

  const handleMudarDia = async (diaSemana: number, servicoIdNovo: string | null, ativo: boolean) => {
    setSalvandoDia(diaSemana);
    try {
      const res = await fetch(`/api/marketing/cronograma/${diaSemana}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servicoId: servicoIdNovo, ativo }),
      });
      if (!res.ok) throw new Error('Erro ao salvar cronograma');
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar cronograma');
    } finally {
      setSalvandoDia(null);
    }
  };

  const handleSalvarGrupo = async () => {
    if (!grupoConfig) return;
    setIsSavingGrupo(true);
    try {
      const res = await fetch('/api/marketing/grupo-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomeGrupo: grupoConfig.nome_grupo,
          avisoListaAtivo: grupoConfig.aviso_lista_ativo,
          marketingAtivo: grupoConfig.marketing_ativo,
          enquetesAtivo: grupoConfig.enquetes_ativo,
        }),
      });
      if (!res.ok) throw new Error('Erro ao salvar');
      alert('Configuração do grupo salva (modo mock — nenhuma mensagem real é enviada ainda).');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar configuração');
    } finally {
      setIsSavingGrupo(false);
    }
  };

  const nomeServico = (id: string) => servicos.find((s) => s.id === id)?.nome || 'Serviço removido';

  return (
    <div className="space-y-6">
      {/* Disparo manual + anúncio */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-[#148296]" />
          <h3 className="text-sm font-bold text-slate-900">Montar Marketing do Serviço</h3>
        </div>
        <p className="text-xs text-slate-500">
          Escolha um serviço, ajuste a mensagem e dispare pro WhatsApp de todos os associados ativos,
          ou publique como anúncio de destaque na página inicial do parceiro (igual um banner
          publicitário, com botão de dispensar).
        </p>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Serviço</label>
          <select
            value={servicoId}
            onChange={(e) => {
              setServicoId(e.target.value);
              setMensagem('');
              setResultado(null);
            }}
            className="w-full sm:w-80 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none cursor-pointer"
          >
            <option value="">Selecione um serviço...</option>
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>

        {servicoSelecionado && (
          <>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Mensagem de disparo (WhatsApp)
              </label>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none resize-none focus:ring-2 focus:ring-[#148296]/30"
              />
            </div>
            {resultado && (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {resultado}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isDisparando || !mensagem.trim()}
                onClick={handleDisparar}
                className="px-3.5 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                {isDisparando ? 'Disparando...' : 'Disparar via WhatsApp'}
              </button>
              <button
                type="button"
                disabled={isPublicandoAnuncio}
                onClick={handlePublicarAnuncio}
                className="px-3.5 py-2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Megaphone className="w-3.5 h-3.5" />
                {isPublicandoAnuncio ? 'Publicando...' : 'Publicar Anúncio na Página do Parceiro'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Cronograma semanal automático */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-[#148296]" />
          <h3 className="text-sm font-bold text-slate-900">Cronograma Semanal Automático</h3>
        </div>
        <p className="text-xs text-slate-500">
          Defina um serviço em destaque por dia da semana — o sistema dispara sozinho, uma vez por
          dia, pelo mesmo agendador que já roda os avisos de WhatsApp (a cada 15 minutos ele confere
          se é dia de disparar).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {DIAS_SEMANA.map((nomeDia, dia) => {
            const linha = cronograma.find((c) => c.dia_semana === dia);
            return (
              <div key={dia} className="border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">{nomeDia}</span>
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={linha?.ativo ?? true}
                      disabled={salvandoDia === dia}
                      onChange={(e) => handleMudarDia(dia, linha?.servico_id ?? null, e.target.checked)}
                      className="rounded border-slate-300 text-[#148296] focus:ring-[#148296] cursor-pointer"
                    />
                    ativo
                  </label>
                </div>
                <select
                  value={linha?.servico_id ?? ''}
                  disabled={salvandoDia === dia}
                  onChange={(e) => handleMudarDia(dia, e.target.value || null, linha?.ativo ?? true)}
                  className="w-full px-2 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-lg outline-none cursor-pointer disabled:opacity-50"
                >
                  <option value="">— nenhum serviço —</option>
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {/* Robô de grupos — MOCK */}
      <div className="bg-white rounded-xl border border-dashed border-purple-300 shadow-2xs p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Users2 className="w-4 h-4 text-purple-600" />
          <h3 className="text-sm font-bold text-slate-900">Robô de Grupos do WhatsApp</h3>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-700">
            <FlaskConical className="w-3 h-3" />
            Mock
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Configuração de um robô que interage num grupo de WhatsApp da ABDCM — avisos de lista,
          marketing e enquetes. Nenhum provedor real de grupo/enquete de WhatsApp está contratado
          ainda (mesma regra das outras integrações: mock primeiro, provedor real só quando
          contratado — ver CLAUDE.md seção 8), então salvar aqui guarda a configuração mas não
          dispara nada de verdade.
        </p>
        {grupoConfig && (
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome do grupo</label>
              <input
                type="text"
                value={grupoConfig.nome_grupo}
                onChange={(e) => setGrupoConfig({ ...grupoConfig, nome_grupo: e.target.value })}
                placeholder="Ex: ABDCM - Associados Ativos"
                className="w-full sm:w-80 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={grupoConfig.aviso_lista_ativo}
                  onChange={(e) => setGrupoConfig({ ...grupoConfig, aviso_lista_ativo: e.target.checked })}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                Avisar quando uma lista abrir/fechar
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={grupoConfig.marketing_ativo}
                  onChange={(e) => setGrupoConfig({ ...grupoConfig, marketing_ativo: e.target.checked })}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                Mandar mensagens de marketing no grupo
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={grupoConfig.enquetes_ativo}
                  onChange={(e) => setGrupoConfig({ ...grupoConfig, enquetes_ativo: e.target.checked })}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                Criar enquetes automáticas
              </label>
            </div>
            <button
              type="button"
              disabled={isSavingGrupo}
              onClick={handleSalvarGrupo}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSavingGrupo ? 'Salvando...' : 'Salvar Configuração'}
            </button>
          </div>
        )}
      </div>

      {/* Histórico */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <History className="w-4 h-4 text-[#148296]" />
          <h3 className="text-sm font-bold text-slate-900">Histórico de Disparos</h3>
        </div>
        {log.length === 0 ? (
          <p className="px-6 py-8 text-center text-xs text-slate-400">Nenhum disparo de marketing ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Quando</th>
                  <th className="px-6 py-3">Serviço</th>
                  <th className="px-6 py-3">Origem</th>
                  <th className="px-6 py-3">Destinatários</th>
                  <th className="px-6 py-3">Mensagem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {log.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-3 font-mono text-slate-500">
                      {new Date(d.disparado_em).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-3 font-semibold text-slate-900">{nomeServico(d.servico_id)}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          d.origem === 'automatico' ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {d.origem === 'automatico' ? 'Cronograma' : 'Manual'}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-bold">{d.quantidade_destinatarios}</td>
                    <td className="px-6 py-3 text-slate-500 truncate max-w-[280px]">{d.mensagem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
