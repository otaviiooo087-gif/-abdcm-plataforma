import React, { useState } from 'react';
import {
  BookOpen,
  UserPlus,
  FileSpreadsheet,
  Send,
  ListOrdered,
  HelpCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building2,
} from 'lucide-react';

export const ManualParceiroView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'geral' | 'cadastrar' | 'importar' | 'enviar' | 'acompanhar' | 'faq'>('geral');

  return (
    <div className="p-8 space-y-6 overflow-y-auto flex-1">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-[#148296]" />
          Manual do Parceiro
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Guia completo de utilização do sistema de Ação Limpa Nome
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('geral')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'geral'
              ? 'bg-[#148296] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          📋 Visão Geral
        </button>
        <button
          onClick={() => setActiveTab('cadastrar')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'cadastrar'
              ? 'bg-[#148296] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          ➕ 1. Cadastrar Nomes
        </button>
        <button
          onClick={() => setActiveTab('importar')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'importar'
              ? 'bg-[#148296] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          📥 2. Importar Lista
        </button>
        <button
          onClick={() => setActiveTab('enviar')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'enviar'
              ? 'bg-[#148296] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          🚀 3. Enviar e Pagar
        </button>
        <button
          onClick={() => setActiveTab('acompanhar')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'acompanhar'
              ? 'bg-[#148296] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          📊 4. Acompanhar Listas
        </button>
        <button
          onClick={() => setActiveTab('faq')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'faq'
              ? 'bg-[#148296] text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          ❓ Dúvidas Frequentes
        </button>
      </div>

      {/* Content based on tab */}
      {activeTab === 'geral' && (
        <div className="space-y-6">
          {/* Stepper overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="w-8 h-8 rounded-full bg-[#148296]/10 text-[#148296] font-bold flex items-center justify-center text-sm">
                1
              </div>
              <h4 className="text-sm font-bold text-slate-900">Cadastrar ou Importar</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Insira nomes individualmente pelo formulário ou faça upload em massa via planilha (.xlsx / .csv).
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="w-8 h-8 rounded-full bg-[#148296]/10 text-[#148296] font-bold flex items-center justify-center text-sm">
                2
              </div>
              <h4 className="text-sm font-bold text-slate-900">Enviar Lista</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Revise os nomes na AÇÃO COLETIVA ativa, clique em Enviar Lista e confirme a quantidade.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="w-8 h-8 rounded-full bg-[#148296]/10 text-[#148296] font-bold flex items-center justify-center text-sm">
                3
              </div>
              <h4 className="text-sm font-bold text-slate-900">Pagamento PIX</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Efetue o pagamento através do QR Code dinâmico ou Copia e Cola. A confirmação é instantânea.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="w-8 h-8 rounded-full bg-[#148296]/10 text-[#148296] font-bold flex items-center justify-center text-sm">
                4
              </div>
              <h4 className="text-sm font-bold text-slate-900">Acompanhar e Baixa</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Monitore o protocolo judicial e a baixa nos birôs (Serasa, Boa Vista, SPC e Cartórios).
              </p>
            </div>
          </div>

          {/* Guidelines Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Clock className="w-4 h-4 text-[#148296]" />
                Prazos e Ciclo
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                O prazo médio para protocolo e distribuição judicial é de até 5 dias úteis após confirmação do pagamento. O prazo de baixa nos birôs é de até 45 dias úteis.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Segurança e LGPD
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Todos os dados são criptografados e mascarados em conformidade rigorosa com a LGPD. Cada operação possui trilha de auditoria imutável.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Building2 className="w-4 h-4 text-[#148296]" />
                Birôs Abrangidos
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                A Ação Coletiva abrange Serasa Experian, Boa Vista SCPC, SPC Brasil, Cenprot Nacional e Cenprot São Paulo (Cartórios de Protesto).
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cadastrar' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4 max-w-3xl">
          <h3 className="text-base font-bold text-slate-900">Como Cadastrar Nomes Avulsos</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            1. Acesse o menu <strong>Enviar Limpa Nome</strong>.<br />
            2. Clique no botão <strong>+ Cadastrar Nome</strong> no topo da página.<br />
            3. Preencha o Nome Completo ou Razão Social, o CPF ou CNPJ (o sistema detecta e formata automaticamente) e o WhatsApp opcional para contato.<br />
            4. Clique em <strong>Cadastrar Nome</strong>. O registro aparecerá imediatamente na tabela como <em>Pendente</em>.
          </p>
        </div>
      )}

      {activeTab === 'importar' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4 max-w-3xl">
          <h3 className="text-base font-bold text-slate-900">Como Importar Nomes em Massa</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            1. Acesse o menu <strong>Enviar Limpa Nome</strong> e clique em <strong>📥 Importar Lista</strong>.<br />
            2. Se preferir, clique em <strong>Baixar Modelo</strong> para obter a planilha formatada.<br />
            3. A Coluna A deve conter o Nome e a Coluna B o CPF ou CNPJ.<br />
            4. Arraste o arquivo ou clique para selecionar. O sistema validará cada linha e exibirá a pré-visualização dos registros válidos.<br />
            5. Clique em <strong>Importar</strong> para concluir.
          </p>
        </div>
      )}

      {activeTab === 'enviar' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4 max-w-3xl">
          <h3 className="text-base font-bold text-slate-900">Envio para Processamento e Pagamento PIX</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            1. Com todos os nomes cadastrados na lista, clique no botão <strong>🚀 Enviar Lista</strong>.<br />
            2. O sistema calcula o valor total (R$ 250,00 por nome) e solicita a confirmação.<br />
            3. Ao confirmar, o QR Code PIX é gerado na tela juntamente com a chave Copia e Cola.<br />
            4. Assim que o pagamento é recebido, a lista é automaticamente liberada para protocolo judicial.
          </p>
        </div>
      )}

      {activeTab === 'acompanhar' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4 max-w-3xl">
          <h3 className="text-base font-bold text-slate-900">Acompanhamento e Relatórios</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            No menu <strong>Minhas Listas</strong>, você encontra a relação completa de todos os seus registros submetidos, com detalhamento do status em cada birô (Serasa, Boa Vista, SPC, Cenprot BR e SP), filtros por período, busca rápida e exportação para Excel.
          </p>
        </div>
      )}

      {activeTab === 'faq' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4 max-w-3xl">
          <h3 className="text-base font-bold text-slate-900">Perguntas Frequentes (FAQ)</h3>
          <div className="space-y-3 text-xs text-slate-700">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <strong className="block text-slate-900 mb-1">Posso editar um nome após o envio?</strong>
              Após o envio e confirmação do lote, os nomes são bloqueados para garantir a integridade do protocolo judicial. Caso necessite retificação urgente, contate nosso suporte via WhatsApp.
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <strong className="block text-slate-900 mb-1">Qual o valor por nome?</strong>
              O valor congelado da tabela para o parceiro Rdz Consultoria Financeira é de R$ 250,00 por nome na AÇÃO COLETIVA 124.
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <strong className="block text-slate-900 mb-1">Como emitir a fatura/recibo?</strong>
              Após o pagamento, o recibo e a fatura ficam disponíveis no menu Financeiro ou no modal de pagamento PIX.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
