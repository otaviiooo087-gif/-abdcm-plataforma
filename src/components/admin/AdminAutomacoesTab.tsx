import React, { useEffect, useState } from 'react';
import { AutomacaoConfig, NotificacaoEnviada, TipoNotificacao } from '../../domain/types.js';
import { Zap, MessageCircle, Clock, RefreshCw, CheckCircle2, XCircle, Phone, Plus, Trash2 } from 'lucide-react';

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
};

const ORDEM: TipoNotificacao[] = ['proximo_lote', 'follow_up_lista', 'status_processo', 'pagamento_pendente', 'lote_encerrado'];

const LABEL_TIPO: Record<TipoNotificacao, string> = {
  proximo_lote: 'Próximo lote',
  follow_up_lista: 'Follow-up',
  status_processo: 'Status',
  pagamento_pendente: 'Pagamento pendente',
  lote_encerrado: 'Encerramento de lote',
};

interface StatusIntegracoes {
  pix: { configurado: boolean };
  whatsapp: { configurado: boolean };
}

export const AdminAutomacoesTab: React.FC = () => {
  const [configs, setConfigs] = useState<AutomacaoConfig[]>([]);
  const [log, setLog] = useState<NotificacaoEnviada[]>([]);
  const [status, setStatus] = useState<StatusIntegracoes | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [novoNumero, setNovoNumero] = useState('');

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
  };

  useEffect(() => {
    load();
  }, []);

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
          return (
            <div key={chave} className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{meta.nome}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{meta.descricao}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(config)}
                  className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border cursor-pointer ${
                    config.ativo
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  {config.ativo ? 'Ativo' : 'Desativado'}
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 italic">
                "{meta.exemplo}"
              </div>

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
                        {LABEL_TIPO[n.tipo]}
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
