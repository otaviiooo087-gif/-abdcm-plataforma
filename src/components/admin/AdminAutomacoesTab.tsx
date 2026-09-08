import React, { useEffect, useState } from 'react';
import {
  AutomacaoConfig,
  NotificacaoEnviada,
  TipoNotificacao,
  MensagemExtra,
  ChamadaConfig,
  ChamadaLog,
  Servico,
} from '../../domain/types.js';
import {
  Zap,
  MessageCircle,
  Clock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Phone,
  Plus,
  Trash2,
  Pencil,
  FlaskConical,
  PhoneCall,
  History,
} from 'lucide-react';

const METADADOS: Record<TipoNotificacao, { nome: string; descricao: string; exemplo: string; campoConfig?: { chave: string; label: string; sufixo: string } }> = {
  proximo_lote: {
    nome: 'Próxima Ação Coletiva abrindo',
    descricao: 'Avisa todos os associados ativos quando uma nova lista (lote) abre pra captação.',
    exemplo:
      'Boa tarde! Aqui é da ABDCM 👋 Passando pra avisar que a próxima Lista Limpa Nome (AÇÃO COLETIVA 125) está com captação aberta, encerrando quarta-feira às 18:00. Aproveita pra anexar seus nomes com o parceiro que cuidou da sua filiação!',
  },
  follow_up_lista: {
    nome: 'Follow-up antes do encerramento',
    descricao: 'Lembra associados que ainda não entraram na lista aberta, um pouco antes dela fechar.',
    exemplo:
      'Oi Luiz! Notei que você ainda não anexou os seus nomes na Lista Limpa Nome, que fecha quarta-feira às 18:00. Anexa agora pra não perder a oportunidade de ter seus nomes limpos!',
    campoConfig: { chave: 'horasAntesDoFechamento', label: 'Avisar quantas horas antes do fechamento', sufixo: 'h' },
  },
  status_processo: {
    nome: 'Status do processo',
    descricao: 'Avisa quando os nomes do associado avançam de fase (pago, protocolado, baixado, recusado).',
    exemplo:
      'Boa tarde João! Passando pra avisar que os nomes anexados na Lista de quarta-feira — Serasa, SPC, Boa Vista, Cartórios de Protesto — se atribuíram ao processo e estamos aguardando as baixas começarem.',
  },
  pagamento_pendente: {
    nome: 'Pagamento PIX pendente',
    descricao: 'Pergunta se deu algum problema quando o PIX de uma lista fica pendente por muito tempo.',
    exemplo:
      'Oi Ana! Vimos que o pagamento PIX da sua lista ainda está pendente. Aconteceu algum problema? Se precisar de ajuda é só responder por aqui 🙂',
    campoConfig: { chave: 'horasParaAvisar', label: 'Avisar após quantas horas pendente', sufixo: 'h' },
  },
  lote_encerrado: {
    nome: 'Encerramento de Ação Coletiva',
    descricao:
      'Avisa a equipe ABDCM (números cadastrados abaixo, não associados) quando uma Ação Coletiva é encerrada na aba Processos, com o link do pacote (planilha + documentos) pra retirar.',
    exemplo: 'Ação Coletiva 124 encerrada! Foram 87 nomes captados. Baixe a documentação completa aqui: https://... (link válido por 7 dias)',
  },
  cadastro_associado: {
    nome: 'Boas-vindas ao se cadastrar',
    descricao: 'Manda uma mensagem de boas-vindas assim que um associado com WhatsApp entra no sistema (individual ou por planilha).',
    exemplo:
      'Boa tarde João! Aqui é da ABDCM 👋 Seja muito bem-vindo(a) ao sistema ABDCM! Você agora faz parte da nossa Ação Coletiva Limpa Nome — fica de olho por aqui que a gente avisa assim que a próxima lista abrir pra você anexar seus nomes.',
  },
};

const ORDEM: TipoNotificacao[] = [
  'cadastro_associado',
  'proximo_lote',
  'follow_up_lista',
  'status_processo',
  'pagamento_pendente',
  'lote_encerrado',
];

const LABEL_TIPO: Record<TipoNotificacao, string> = {
  proximo_lote: 'Próximo lote',
  follow_up_lista: 'Follow-up',
  status_processo: 'Status',
  pagamento_pendente: 'Pagamento pendente',
  lote_encerrado: 'Encerramento de lote',
  cadastro_associado: 'Boas-vindas',
};

interface StatusIntegracoes {
  pix: { configurado: boolean };
  whatsapp: { configurado: boolean };
}

const GATILHOS_MENSAGEM: TipoNotificacao[] = [
  'cadastro_associado',
  'proximo_lote',
  'follow_up_lista',
  'status_processo',
  'pagamento_pendente',
];

const emptyChamadaForm = {
  servicoId: '',
  nome: '',
  roteiroAbertura: '',
  roteiroRespostaSim: '',
  roteiroRespostaNao: '',
  diasAntesPrazo: '',
};

export const AdminAutomacoesTab: React.FC = () => {
  const [configs, setConfigs] = useState<AutomacaoConfig[]>([]);
  const [log, setLog] = useState<NotificacaoEnviada[]>([]);
  const [status, setStatus] = useState<StatusIntegracoes | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [novoNumero, setNovoNumero] = useState('');

  // Editar mensagem padrão de cada automação
  const [editandoMensagemChave, setEditandoMensagemChave] = useState<TipoNotificacao | null>(null);
  const [rascunhoMensagem, setRascunhoMensagem] = useState('');

  // Mensagens extras (botão "Criar Nova Mensagem")
  const [mensagensExtra, setMensagensExtra] = useState<MensagemExtra[]>([]);
  const [showNovaExtra, setShowNovaExtra] = useState(false);
  const [novaExtra, setNovaExtra] = useState({ gatilho: 'proximo_lote' as TipoNotificacao, nome: '', mensagem: '' });

  // Automação de ligação (mock)
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [chamadasConfig, setChamadasConfig] = useState<ChamadaConfig[]>([]);
  const [chamadasLog, setChamadasLog] = useState<ChamadaLog[]>([]);
  const [showNovaChamada, setShowNovaChamada] = useState(false);
  const [chamadaForm, setChamadaForm] = useState(emptyChamadaForm);
  const [testandoId, setTestandoId] = useState<string | null>(null);
  const [telefoneTeste, setTelefoneTeste] = useState('');

  const load = () => {
    fetch('/api/automacoes')
      .then((res) => (res.ok ? res.json() : []))
      .then(setConfigs)
      .catch(() => setConfigs([]));
    fetch('/api/automacoes/log')
      .then((res) => (res.ok ? res.json() : []))
      .then(setLog)
      .catch(() => setLog([]));
    fetch('/api/config/status')
      .then((res) => (res.ok ? res.json() : null))
      .then(setStatus)
      .catch(() => setStatus(null));
    fetch('/api/automacoes/mensagens-extra')
      .then((res) => (res.ok ? res.json() : []))
      .then(setMensagensExtra)
      .catch(() => setMensagensExtra([]));
    fetch('/api/servicos')
      .then((res) => (res.ok ? res.json() : []))
      .then(setServicos)
      .catch(() => setServicos([]));
    fetch('/api/automacoes/chamadas')
      .then((res) => (res.ok ? res.json() : []))
      .then(setChamadasConfig)
      .catch(() => setChamadasConfig([]));
    fetch('/api/automacoes/chamadas/log')
      .then((res) => (res.ok ? res.json() : []))
      .then(setChamadasLog)
      .catch(() => setChamadasLog([]));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAbrirEditarMensagem = (chave: TipoNotificacao) => {
    const config = configs.find((c) => c.chave === chave);
    const atual = typeof config?.config.mensagemTemplate === 'string' ? config.config.mensagemTemplate : '';
    setRascunhoMensagem(atual || METADADOS[chave].exemplo);
    setEditandoMensagemChave(chave);
  };

  const handleSalvarMensagem = async () => {
    if (!editandoMensagemChave) return;
    const config = configs.find((c) => c.chave === editandoMensagemChave);
    await fetch(`/api/automacoes/${editandoMensagemChave}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { ...(config?.config || {}), mensagemTemplate: rascunhoMensagem.trim() } }),
    });
    setEditandoMensagemChave(null);
    load();
  };

  const handleRestaurarPadrao = async () => {
    if (!editandoMensagemChave) return;
    const config = configs.find((c) => c.chave === editandoMensagemChave);
    const { mensagemTemplate: _remover, ...resto } = config?.config || {};
    await fetch(`/api/automacoes/${editandoMensagemChave}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: resto }),
    });
    setEditandoMensagemChave(null);
    load();
  };

  const handleCriarExtra = async () => {
    if (!novaExtra.nome.trim() || !novaExtra.mensagem.trim()) return;
    const res = await fetch('/api/automacoes/mensagens-extra', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novaExtra),
    });
    if (res.ok) {
      setNovaExtra({ gatilho: 'proximo_lote', nome: '', mensagem: '' });
      setShowNovaExtra(false);
      load();
    }
  };

  const handleToggleExtra = async (extra: MensagemExtra) => {
    await fetch(`/api/automacoes/mensagens-extra/${extra.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !extra.ativo }),
    });
    load();
  };

  const handleRemoverExtra = async (extra: MensagemExtra) => {
    if (!confirm(`Remover a mensagem "${extra.nome}"?`)) return;
    await fetch(`/api/automacoes/mensagens-extra/${extra.id}`, { method: 'DELETE' });
    load();
  };

  const handleCriarChamada = async () => {
    if (!chamadaForm.nome.trim() || !chamadaForm.roteiroAbertura.trim() || !chamadaForm.roteiroRespostaSim.trim() || !chamadaForm.roteiroRespostaNao.trim()) return;
    const res = await fetch('/api/automacoes/chamadas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        servicoId: chamadaForm.servicoId || null,
        nome: chamadaForm.nome.trim(),
        roteiroAbertura: chamadaForm.roteiroAbertura.trim(),
        roteiroRespostaSim: chamadaForm.roteiroRespostaSim.trim(),
        roteiroRespostaNao: chamadaForm.roteiroRespostaNao.trim(),
        diasAntesPrazo: chamadaForm.diasAntesPrazo ? parseInt(chamadaForm.diasAntesPrazo, 10) : null,
      }),
    });
    if (res.ok) {
      setChamadaForm(emptyChamadaForm);
      setShowNovaChamada(false);
      load();
    }
  };

  const handleToggleChamada = async (c: ChamadaConfig) => {
    await fetch(`/api/automacoes/chamadas/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !c.ativo }),
    });
    load();
  };

  const handleRemoverChamada = async (c: ChamadaConfig) => {
    if (!confirm(`Remover a configuração de ligação "${c.nome}"?`)) return;
    await fetch(`/api/automacoes/chamadas/${c.id}`, { method: 'DELETE' });
    load();
  };

  const handleTestarChamada = async (configId: string) => {
    if (!telefoneTeste.trim()) {
      alert('Informe um telefone pra testar.');
      return;
    }
    setTestandoId(configId);
    try {
      const res = await fetch(`/api/automacoes/chamadas/${configId}/testar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: telefoneTeste.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao testar ligação');
      alert(`Resultado (mock): ${data.resultado}\n\n${data.transcricao}`);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao testar ligação');
    } finally {
      setTestandoId(null);
    }
  };

  const handleToggle = async (config: AutomacaoConfig) => {
    await fetch(`/api/automacoes/${config.chave}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !config.ativo }),
    });
    load();
  };

  const handleConfigChange = async (config: AutomacaoConfig, campo: string, valor: number) => {
    await fetch(`/api/automacoes/${config.chave}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { ...config.config, [campo]: valor } }),
    });
    load();
  };

  const handleAddNumero = async (config: AutomacaoConfig) => {
    const numero = novoNumero.trim();
    if (!numero) return;
    const numerosAtuais = Array.isArray(config.config.numeros) ? (config.config.numeros as string[]) : [];
    if (numerosAtuais.includes(numero)) {
      setNovoNumero('');
      return;
    }
    await fetch(`/api/automacoes/${config.chave}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { ...config.config, numeros: [...numerosAtuais, numero] } }),
    });
    setNovoNumero('');
    load();
  };

  const handleRemoveNumero = async (config: AutomacaoConfig, numero: string) => {
    const numerosAtuais = Array.isArray(config.config.numeros) ? (config.config.numeros as string[]) : [];
    await fetch(`/api/automacoes/${config.chave}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { ...config.config, numeros: numerosAtuais.filter((n) => n !== numero) } }),
    });
    load();
  };

  const handleRodarAgora = async () => {
    setIsRunning(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/automacoes/rodar-agora', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao rodar automações');
      const total = (data.proximoLote ?? 0) + (data.followUpLista ?? 0) + (data.pagamentoPendente ?? 0);
      setRunResult(`${total} aviso(s) enviado(s) agora.`);
      load();
    } catch (err) {
      setRunResult(err instanceof Error ? err.message : 'Erro ao rodar automações');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#148296]" />
            Automações
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Avisos automáticos por WhatsApp e status das integrações de pagamento e mensageria
          </p>
        </div>
        <button
          type="button"
          disabled={isRunning}
          onClick={handleRodarAgora}
          className="px-3.5 py-2 text-xs font-bold text-[#148296] bg-white hover:bg-slate-50 border border-[#148296]/40 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Rodando...' : 'Rodar agora'}
        </button>
      </div>

      {runResult && (
        <div className="text-xs font-semibold text-[#148296] bg-[#148296]/5 border border-[#148296]/20 rounded-lg px-3.5 py-2.5">
          {runResult}
        </div>
      )}

      {/* Status das integrações que alimentam as automações */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-700">PIX (Asaas)</span>
          {status?.pix.configurado ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
              <XCircle className="w-3.5 h-3.5" /> Simulação
            </span>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-700">WhatsApp (Z-API)</span>
          {status?.whatsapp.configurado ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
              <XCircle className="w-3.5 h-3.5" /> Simulação (só no log do servidor)
            </span>
          )}
        </div>
      </div>

      {/* Regras de automação */}
      <div className="space-y-3">
        {ORDEM.map((chave) => {
          const config = configs.find((c) => c.chave === chave);
          const meta = METADADOS[chave];
          if (!config) return null;
          const mensagemCustom = typeof config.config.mensagemTemplate === 'string' ? config.config.mensagemTemplate : '';
          return (
            <div key={chave} className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{meta.nome}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{meta.descricao}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAbrirEditarMensagem(chave)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold text-[#148296] bg-[#148296]/10 hover:bg-[#148296]/20 cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    Editar Mensagem
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggle(config)}
                    className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border cursor-pointer ${
                      config.ativo
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {config.ativo ? 'Ativo' : 'Desativado'}
                  </button>
                </div>
              </div>

              {editandoMensagemChave === chave ? (
                <div className="space-y-2 bg-[#148296]/5 border border-[#148296]/20 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500">
                    Use <code className="bg-white px-1 rounded border border-slate-200">{'{saudacao}'}</code>,{' '}
                    <code className="bg-white px-1 rounded border border-slate-200">{'{nome}'}</code> e{' '}
                    <code className="bg-white px-1 rounded border border-slate-200">{'{lote}'}</code> pra personalizar automaticamente.
                  </p>
                  <textarea
                    value={rascunhoMensagem}
                    onChange={(e) => setRascunhoMensagem(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none resize-none focus:ring-2 focus:ring-[#148296]/30"
                  />
                  <div className="flex justify-end gap-2">
                    {mensagemCustom && (
                      <button
                        type="button"
                        onClick={handleRestaurarPadrao}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        Restaurar padrão
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditandoMensagemChave(null)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSalvarMensagem}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs cursor-pointer"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 italic">
                  "{mensagemCustom || meta.exemplo}"
                  {mensagemCustom && <span className="not-italic ml-2 text-[10px] font-bold text-[#148296] uppercase">personalizada</span>}
                </div>
              )}

              {meta.campoConfig && (
                <label className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {meta.campoConfig.label}:
                  <input
                    type="number"
                    min={1}
                    value={Number(config.config[meta.campoConfig.chave] ?? 0)}
                    onChange={(e) => handleConfigChange(config, meta.campoConfig!.chave, Number(e.target.value))}
                    className="w-16 px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30"
                  />
                  {meta.campoConfig.sufixo}
                </label>
              )}

              {chave === 'lote_encerrado' && (
                <div className="space-y-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    Números que recebem o aviso
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(Array.isArray(config.config.numeros) ? (config.config.numeros as string[]) : []).map((numero) => (
                      <span
                        key={numero}
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                      >
                        {numero}
                        <button
                          type="button"
                          onClick={() => handleRemoveNumero(config, numero)}
                          title="Remover número"
                          className="p-0.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {(!Array.isArray(config.config.numeros) || config.config.numeros.length === 0) && (
                      <span className="text-[11px] text-slate-400 italic">Nenhum número cadastrado ainda.</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={novoNumero}
                      onChange={(e) => setNovoNumero(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddNumero(config);
                      }}
                      placeholder="+5511987654321"
                      className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30 w-44"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddNumero(config)}
                      className="px-2.5 py-1.5 text-xs font-bold text-[#148296] bg-[#148296]/10 hover:bg-[#148296]/20 rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mensagens extras — "Criar Nova Mensagem" */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Mensagens Extras</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Além da mensagem padrão de cada automação, acrescente mensagens extras que são enviadas junto — pra
              variações, avisos adicionais ou testes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNovaExtra((v) => !v)}
            className="shrink-0 px-3 py-1.5 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Criar Nova Mensagem
          </button>
        </div>

        {showNovaExtra && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Gatilho</label>
                <select
                  value={novaExtra.gatilho}
                  onChange={(e) => setNovaExtra({ ...novaExtra, gatilho: e.target.value as TipoNotificacao })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none cursor-pointer"
                >
                  {GATILHOS_MENSAGEM.map((g) => (
                    <option key={g} value={g}>
                      {METADADOS[g].nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome (interno)</label>
                <input
                  type="text"
                  value={novaExtra.nome}
                  onChange={(e) => setNovaExtra({ ...novaExtra, nome: e.target.value })}
                  placeholder="Ex: Variação de boas-vindas B"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mensagem</label>
              <textarea
                value={novaExtra.mensagem}
                onChange={(e) => setNovaExtra({ ...novaExtra, mensagem: e.target.value })}
                rows={3}
                placeholder="Use {saudacao}, {nome} e {lote} pra personalizar."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none resize-none focus:ring-2 focus:ring-[#148296]/30"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNovaExtra(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCriarExtra}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs cursor-pointer"
              >
                Salvar Mensagem
              </button>
            </div>
          </div>
        )}

        {mensagensExtra.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Nenhuma mensagem extra cadastrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {mensagensExtra.map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-200 text-slate-600 shrink-0">
                      {METADADOS[m.gatilho]?.nome ?? m.gatilho}
                    </span>
                    <p className="text-xs font-bold text-slate-900 truncate">{m.nome}</p>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{m.mensagem}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleExtra(m)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                      m.ativo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {m.ativo ? 'Ativa' : 'Inativa'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoverExtra(m)}
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

      {/* Automação de ligação — MOCK */}
      <div className="bg-white rounded-xl border border-dashed border-purple-300 shadow-2xs p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-purple-600" />
              Automação de Ligação
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-700">
                <FlaskConical className="w-3 h-3" />
                Mock
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
              Roteiro de ligação por serviço, com ramificação sim/não (ex.: "posso contar com você?" → se sim, envia o
              link de cadastro automaticamente). Nenhum provedor real de telefonia/IVR está contratado ainda — as
              ligações abaixo são simuladas, com transcrição de exemplo, pra desenhar a automação com antecedência.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNovaChamada((v) => !v)}
            className="shrink-0 px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Configuração de Ligação
          </button>
        </div>

        {showNovaChamada && (
          <div className="bg-purple-50/50 border border-purple-200 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome</label>
                <input
                  type="text"
                  value={chamadaForm.nome}
                  onChange={(e) => setChamadaForm({ ...chamadaForm, nome: e.target.value })}
                  placeholder="Ex: Convite Ação Limpa Nome"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Serviço</label>
                <select
                  value={chamadaForm.servicoId}
                  onChange={(e) => setChamadaForm({ ...chamadaForm, servicoId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none cursor-pointer"
                >
                  <option value="">Ação Limpa Nome (lotes)</option>
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Follow-up: dias antes do prazo
                </label>
                <input
                  type="number"
                  min={0}
                  value={chamadaForm.diasAntesPrazo}
                  onChange={(e) => setChamadaForm({ ...chamadaForm, diasAntesPrazo: e.target.value })}
                  placeholder="Ex: 2"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Roteiro de abertura</label>
              <textarea
                value={chamadaForm.roteiroAbertura}
                onChange={(e) => setChamadaForm({ ...chamadaForm, roteiroAbertura: e.target.value })}
                rows={2}
                placeholder='Ex: "{saudacao} {nome}, aqui é da ABDCM, tudo bem? Passando para avisar que a próxima Ação Limpa Nome está agendada para {lote}, posso contar com você?"'
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none resize-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Se responder "sim"</label>
                <textarea
                  value={chamadaForm.roteiroRespostaSim}
                  onChange={(e) => setChamadaForm({ ...chamadaForm, roteiroRespostaSim: e.target.value })}
                  rows={2}
                  placeholder='Ex: "Maravilha {nome}! Estou te encaminhando o link do sistema para você anexar os seus nomes. Ótima tarde!"'
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none resize-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Se responder "não"</label>
                <textarea
                  value={chamadaForm.roteiroRespostaNao}
                  onChange={(e) => setChamadaForm({ ...chamadaForm, roteiroRespostaNao: e.target.value })}
                  rows={2}
                  placeholder='Ex: "Sem problemas, {nome}! Qualquer coisa é só chamar a gente pelo WhatsApp."'
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none resize-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNovaChamada(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCriarChamada}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs cursor-pointer"
              >
                Salvar Configuração
              </button>
            </div>
          </div>
        )}

        {chamadasConfig.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Nenhuma automação de ligação configurada ainda.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={telefoneTeste}
                onChange={(e) => setTelefoneTeste(e.target.value)}
                placeholder="+5511987654321 (pra testar)"
                className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-300 w-52"
              />
            </div>
            {chamadasConfig.map((c) => (
              <div key={c.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900">{c.nome}</p>
                    <p className="text-[10px] text-slate-500">
                      {c.servico_id ? servicos.find((s) => s.id === c.servico_id)?.nome || 'Serviço removido' : 'Ação Limpa Nome (lotes)'}
                      {c.dias_antes_prazo != null && ` • follow-up ${c.dias_antes_prazo} dia(s) antes do prazo`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={testandoId === c.id}
                      onClick={() => handleTestarChamada(c.id)}
                      className="px-2.5 py-1 text-[10px] font-bold text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      {testandoId === c.id ? 'Ligando...' : 'Testar Ligação'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleChamada(c)}
                      className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer ${
                        c.ativo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {c.ativo ? 'Ativa' : 'Inativa'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoverChamada(c)}
                      className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 italic">"{c.roteiro_abertura}"</p>
              </div>
            ))}
          </div>
        )}

        {chamadasLog.length > 0 && (
          <div className="pt-2 border-t border-purple-100">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
              <History className="w-3.5 h-3.5 text-purple-500" />
              Histórico de Ligações (mock)
            </span>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="text-[9px] text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-1.5 pr-3">Quando</th>
                    <th className="py-1.5 pr-3">Telefone</th>
                    <th className="py-1.5 pr-3">Origem</th>
                    <th className="py-1.5 pr-3">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {chamadasLog.map((l) => (
                    <tr key={l.id}>
                      <td className="py-1.5 pr-3 font-mono">{new Date(l.criado_em).toLocaleString('pt-BR')}</td>
                      <td className="py-1.5 pr-3 font-mono">{l.telefone}</td>
                      <td className="py-1.5 pr-3">{l.origem === 'automatico' ? 'Follow-up' : 'Teste manual'}</td>
                      <td className="py-1.5 pr-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            l.resultado === 'sim'
                              ? 'bg-emerald-50 text-emerald-700'
                              : l.resultado === 'nao'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {l.resultado === 'sim' ? 'Sim' : l.resultado === 'nao' ? 'Não' : 'Sem resposta'}
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

      {/* Log de envios */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[#148296]" />
          <h3 className="text-sm font-bold text-slate-900">Últimos Avisos Enviados</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Tipo</th>
                <th className="px-6 py-3">Telefone</th>
                <th className="px-6 py-3">Mensagem</th>
                <th className="px-6 py-3">Quando</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {log.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                    Nenhum aviso enviado ainda.
                  </td>
                </tr>
              ) : (
                log.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-3">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                        {LABEL_TIPO[n.tipo] || (n.tipo.startsWith('extra:') ? 'Mensagem extra' : n.tipo)}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-slate-600 whitespace-nowrap">{n.destinatario_telefone}</td>
                    <td className="px-6 py-3 text-slate-600 max-w-md truncate">{n.mensagem}</td>
                    <td className="px-6 py-3 font-mono text-slate-500 whitespace-nowrap">
                      {new Date(n.enviado_em).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
