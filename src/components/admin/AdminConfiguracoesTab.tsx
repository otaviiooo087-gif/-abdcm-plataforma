import React, { useEffect, useRef, useState } from 'react';
import { Contrato, ConfiguracaoEmpresa } from '../../domain/types.js';
import {
  Settings,
  FileSignature,
  UploadCloud,
  Download,
  Plug,
  QrCode,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Trash2,
  Building2,
  Save,
  Scale,
} from 'lucide-react';

type ConfigSubTab = 'empresa' | 'geral' | 'apis';

const EMPTY_EMPRESA: Omit<ConfiguracaoEmpresa, 'tenant_id' | 'atualizado_em'> = {
  razao_social: '',
  cnpj: '',
  endereco: '',
  telefone: '',
  email: '',
  banco_nome: '',
  banco_agencia: '',
  banco_conta: '',
  banco_pix_chave: '',
  oab_numero: '',
  oab_uf: '',
};

interface StatusIntegracoes {
  pix: { provider: string; configurado: boolean };
  whatsapp: { provider: string; configurado: boolean };
}

export const AdminConfiguracoesTab: React.FC = () => {
  const [subTab, setSubTab] = useState<ConfigSubTab>('empresa');
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [tituloNovoDocumento, setTituloNovoDocumento] = useState('');
  const [isUploadingContrato, setIsUploadingContrato] = useState(false);
  const [status, setStatus] = useState<StatusIntegracoes | null>(null);
  const contratoInputRef = useRef<HTMLInputElement>(null);

  const [empresa, setEmpresa] = useState(EMPTY_EMPRESA);
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false);
  const [empresaSalva, setEmpresaSalva] = useState(false);

  useEffect(() => {
    fetch('/api/config/empresa')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ConfiguracaoEmpresa | null) => {
        if (data) setEmpresa(data);
      })
      .catch(() => {});
  }, []);

  const handleSalvarEmpresa = async () => {
    setSalvandoEmpresa(true);
    setEmpresaSalva(false);
    try {
      const res = await fetch('/api/config/empresa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razaoSocial: empresa.razao_social,
          cnpj: empresa.cnpj,
          endereco: empresa.endereco,
          telefone: empresa.telefone,
          email: empresa.email,
          bancoNome: empresa.banco_nome,
          bancoAgencia: empresa.banco_agencia,
          bancoConta: empresa.banco_conta,
          bancoPixChave: empresa.banco_pix_chave,
          oabNumero: empresa.oab_numero,
          oabUf: empresa.oab_uf,
        }),
      });
      if (!res.ok) throw new Error('Erro ao salvar');
      setEmpresaSalva(true);
      setTimeout(() => setEmpresaSalva(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar dados da empresa');
    } finally {
      setSalvandoEmpresa(false);
    }
  };

  const campoEmpresa = (
    label: string,
    campo: keyof typeof EMPTY_EMPRESA,
    placeholder?: string,
  ) => (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</label>
      <input
        type="text"
        value={empresa[campo]}
        onChange={(e) => setEmpresa({ ...empresa, [campo]: e.target.value })}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-[#148296]/30"
      />
    </div>
  );

  const loadContratos = () => {
    fetch('/api/contratos')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Contrato[]) => setContratos(data))
      .catch(() => setContratos([]));
  };

  useEffect(() => {
    loadContratos();
    fetch('/api/config/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StatusIntegracoes | null) => setStatus(data))
      .catch(() => setStatus(null));
  }, []);

  const handleContratoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const titulo = tituloNovoDocumento.trim();
    if (!titulo) {
      alert('Informe um título pro documento antes de anexar (ex.: "Ficha Associativa - Modelo").');
      return;
    }
    setIsUploadingContrato(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          nomeArquivo: file.name,
          mimeType: file.type || 'application/pdf',
          conteudoBase64: base64,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao anexar documento');
      setContratos((prev) => [data, ...prev]);
      setTituloNovoDocumento('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao anexar documento');
    } finally {
      setIsUploadingContrato(false);
    }
  };

  const handleRemoverDocumento = async (id: string) => {
    if (!confirm('Remover este documento? Ele deixa de aparecer pro parceiro.')) return;
    try {
      const res = await fetch(`/api/contratos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao remover documento');
      setContratos((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao remover documento');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-[#148296]" />
        <h2 className="text-lg font-bold text-slate-900">Configurações</h2>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setSubTab('empresa')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px cursor-pointer transition-colors flex items-center gap-1.5 ${
            subTab === 'empresa'
              ? 'border-[#148296] text-[#148296]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Empresa
        </button>
        <button
          type="button"
          onClick={() => setSubTab('geral')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px cursor-pointer transition-colors ${
            subTab === 'geral'
              ? 'border-[#148296] text-[#148296]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Geral
        </button>
        <button
          type="button"
          onClick={() => setSubTab('apis')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 -mb-px cursor-pointer transition-colors flex items-center gap-1.5 ${
            subTab === 'apis'
              ? 'border-[#148296] text-[#148296]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Plug className="w-3.5 h-3.5" />
          APIs
        </button>
      </div>

      {subTab === 'empresa' && (
        <div className="space-y-5 max-w-2xl">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#148296]" />
              <h3 className="text-sm font-bold text-slate-900">Dados da Empresa</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {campoEmpresa('Razão Social', 'razao_social', 'Associação Brasileira de Defesa do Consumidor')}
              {campoEmpresa('CNPJ', 'cnpj', '00.000.000/0001-00')}
              {campoEmpresa('Telefone', 'telefone', '(11) 0000-0000')}
              {campoEmpresa('E-mail', 'email', 'contato@abdcm.org.br')}
            </div>
            {campoEmpresa('Endereço', 'endereco', 'Rua, número, bairro, cidade — UF')}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-[#148296]" />
              <h3 className="text-sm font-bold text-slate-900">Conta Bancária</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {campoEmpresa('Banco', 'banco_nome', 'Ex: Banco do Brasil')}
              {campoEmpresa('Agência', 'banco_agencia', '0000')}
              {campoEmpresa('Conta', 'banco_conta', '00000-0')}
              {campoEmpresa('Chave PIX', 'banco_pix_chave', 'financeiro@abdcm.org.br')}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#148296]" />
              <h3 className="text-sm font-bold text-slate-900">OAB (monitoramento de processos)</h3>
            </div>
            <p className="text-xs text-slate-500">
              Número da OAB usado numa futura integração de monitoramento automático de processos
              junto aos tribunais. Nenhum provedor está contratado ainda — o sistema guarda o
              número, mas a consulta automática fica pendente até uma conta real ser configurada.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {campoEmpresa('Número da OAB', 'oab_numero', '000000')}
              {campoEmpresa('UF', 'oab_uf', 'SP')}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={salvandoEmpresa}
              onClick={handleSalvarEmpresa}
              className="px-4 py-2 text-xs font-bold text-white bg-[#148296] hover:bg-[#0f6b7c] rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {salvandoEmpresa ? 'Salvando...' : 'Salvar Dados'}
            </button>
            {empresaSalva && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Salvo com sucesso
              </span>
            )}
          </div>
        </div>
      )}

      {subTab === 'geral' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4 max-w-2xl">
          <div className="flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-[#148296]" />
            <h3 className="text-sm font-bold text-slate-900">Contratos e Documentos Complementares</h3>
          </div>
          <p className="text-xs text-slate-500">
            Anexe quantos documentos precisar — modelo de ficha associativa, contrato de
            intermediação, e outros — todos ficam disponíveis pro parceiro consultar e baixar.
          </p>

          {contratos.length === 0 ? (
            <div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg p-3.5">
              Nenhum documento anexado ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {contratos.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3.5"
                >
                  <div className="flex items-center gap-2.5 text-emerald-900 min-w-0">
                    <FileSignature className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{c.titulo}</p>
                      <p className="text-[11px] text-emerald-700 truncate">
                        {c.nome_arquivo} · Atualizado em {new Date(c.atualizado_em).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <a
                      href={`data:${c.mime_type};base64,${c.conteudo_base64}`}
                      download={c.nome_arquivo}
                      className="text-xs font-bold text-[#148296] hover:underline flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar
                    </a>
                    <button
                      type="button"
                      title="Remover documento"
                      onClick={() => handleRemoverDocumento(c.id)}
                      className="text-red-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Novo documento
            </label>
            <input
              type="text"
              value={tituloNovoDocumento}
              onChange={(e) => setTituloNovoDocumento(e.target.value)}
              placeholder='Título (ex.: "Ficha Associativa - Modelo")'
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#148296]/30 focus:border-[#148296] outline-none"
            />
            <button
              type="button"
              disabled={isUploadingContrato}
              onClick={() => contratoInputRef.current?.click()}
              className="px-3.5 py-2 text-xs font-bold text-[#148296] bg-white hover:bg-slate-50 border border-[#148296]/40 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4" />
              {isUploadingContrato ? 'Enviando...' : 'Anexar Documento'}
            </button>
          </div>
          <input
            ref={contratoInputRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={handleContratoSelected}
          />
        </div>
      )}

      {subTab === 'apis' && (
        <div className="space-y-4 max-w-2xl">
          <p className="text-xs text-slate-500">
            Chaves de API nunca ficam no código nem no banco — só em variável de ambiente
            (Railway → Variables), por segurança (invariante I10). Aqui você só confere se
            cada integração está ativa.
          </p>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#148296]/10 text-[#148296] flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">PIX — Asaas</p>
                <p className="text-[11px] text-slate-500">
                  Gera o QR Code automático na aba Enviar Lista. Variáveis: PIX_PROVIDER=real,
                  ASAAS_API_KEY, ASAAS_ENV.
                </p>
              </div>
            </div>
            {status?.pix.configurado ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Conectado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                <XCircle className="w-3.5 h-3.5" />
                Modo simulação
              </span>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#148296]/10 text-[#148296] flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">WhatsApp — Z-API</p>
                <p className="text-[11px] text-slate-500">
                  Envia os avisos automáticos da aba Automações. Variáveis:
                  WHATSAPP_PROVIDER=real, ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN.
                </p>
              </div>
            </div>
            {status?.whatsapp.configurado ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Conectado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                <XCircle className="w-3.5 h-3.5" />
                Modo simulação
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
