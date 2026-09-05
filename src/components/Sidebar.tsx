import React from 'react';
import { UserSession } from '../server/mockDb.js';
import {
  LayoutDashboard,
  ShieldCheck,
  Search,
  Layers,
  FileCheck2,
  Receipt,
  Users,
  Building2,
  Lock,
  ShoppingBag,
  Calendar,
  RotateCw,
  BookOpen,
  ListOrdered,
  DollarSign,
  AlertTriangle,
  Calculator,
  FileSignature,
  FileText,
  GraduationCap,
  Activity,
  ClipboardList,
  Check,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  currentSurface: 'parceiro' | 'admin' | 'publico';
  onSelectSurface: (surface: 'parceiro' | 'admin' | 'publico') => void;
  adminTab: 'processos' | 'financeiro' | 'operacao' | 'registros' | 'controle';
  onSelectAdminTab: (tab: 'processos' | 'financeiro' | 'operacao' | 'controle') => void;
  parceiroTab?: string;
  onSelectParceiroTab?: (tab: string) => void;
  session: UserSession | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSurface,
  onSelectSurface,
  adminTab,
  onSelectAdminTab,
  parceiroTab = 'enviar-limpa-nome',
  onSelectParceiroTab,
  session,
}) => {
  const getInitials = (name: string) => {
    return (name || 'RD')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const isParceiro = currentSurface === 'parceiro';

  return (
    <aside className="w-[245px] flex flex-col h-full shrink-0 select-none overflow-y-auto bg-[#106778] text-white">
      {/* Brand Header */}
      <div className="p-5 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white shadow-2xs">
            <ShieldCheck className="w-5 h-5 text-emerald-300" />
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-extrabold tracking-tight text-lg leading-tight">ABDCM</span>
              <span className="w-4 h-4 bg-emerald-400 rounded-full flex items-center justify-center text-[#106778]">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </span>
            </div>
            <span className="text-[10px] text-white/70 font-medium tracking-wide uppercase block leading-tight">
              Ação Coletiva
            </span>
          </div>
        </div>
      </div>

      {/* Seção Principal: Portal do Parceiro (ABDCM Menu) */}
      {isParceiro ? (
        <nav className="flex-1 px-3 py-4 space-y-4 text-xs">
          {/* Menus Principais */}
          <div className="space-y-0.5">
            <button
              onClick={() => onSelectParceiroTab?.('home')}
              className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                parceiroTab === 'home'
                  ? 'bg-[#0c4f5d] font-bold text-white shadow-2xs'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 opacity-90 shrink-0" />
              <span>Home</span>
            </button>

            <button
              onClick={() => onSelectParceiroTab?.('servicos')}
              className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                parceiroTab === 'servicos'
                  ? 'bg-[#0c4f5d] font-bold text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-4 h-4 opacity-90 shrink-0" />
              <span>Serviços</span>
            </button>

            <button
              onClick={() => onSelectParceiroTab?.('eventos')}
              className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                parceiroTab === 'eventos'
                  ? 'bg-[#0c4f5d] font-bold text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4 opacity-90 shrink-0" />
              <span>Eventos</span>
            </button>
          </div>

          <div className="border-t border-white/10 pt-3">
            <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider px-3 mb-1.5">
              AÇÃO LIMPA NOME
            </p>
            <div className="space-y-0.5">
              <button
                onClick={() => onSelectParceiroTab?.('enviar-limpa-nome')}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                  parceiroTab === 'enviar-limpa-nome'
                    ? 'bg-[#0c4f5d] font-bold text-white shadow-2xs'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>Enviar Limpa Nome</span>
              </button>

              <button
                onClick={() => onSelectParceiroTab?.('reprotocolo')}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                  parceiroTab === 'reprotocolo'
                    ? 'bg-[#0c4f5d] font-bold text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <RotateCw className="w-4 h-4 opacity-90 shrink-0" />
                <span>Reprotocolo</span>
              </button>

              <button
                onClick={() => onSelectParceiroTab?.('manual')}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                  parceiroTab === 'manual'
                    ? 'bg-[#0c4f5d] font-bold text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <BookOpen className="w-4 h-4 opacity-90 shrink-0" />
                <span>Manual do Parceiro</span>
              </button>

              <button
                onClick={() => onSelectParceiroTab?.('minhas-listas')}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                  parceiroTab === 'minhas-listas'
                    ? 'bg-[#0c4f5d] font-bold text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <ListOrdered className="w-4 h-4 opacity-90 shrink-0" />
                <span>Minhas Listas</span>
              </button>

              <button
                onClick={() => onSelectParceiroTab?.('financeiro')}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                  parceiroTab === 'financeiro'
                    ? 'bg-[#0c4f5d] font-bold text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <DollarSign className="w-4 h-4 opacity-90 shrink-0" />
                <span>Financeiro</span>
              </button>

              <button
                onClick={() => onSelectParceiroTab?.('reclame-aqui')}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                  parceiroTab === 'reclame-aqui'
                    ? 'bg-[#0c4f5d] font-bold text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <AlertTriangle className="w-4 h-4 opacity-90 shrink-0" />
                <span>Reclame Aqui</span>
              </button>

              <button
                onClick={() => onSelectParceiroTab?.('orcamento')}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                  parceiroTab === 'orcamento'
                    ? 'bg-[#0c4f5d] font-bold text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Calculator className="w-4 h-4 opacity-90 shrink-0" />
                <span>Orçamento</span>
              </button>

              <button
                onClick={() => onSelectParceiroTab?.('contrato')}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                  parceiroTab === 'contrato'
                    ? 'bg-[#0c4f5d] font-bold text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <FileSignature className="w-4 h-4 opacity-90 shrink-0" />
                <span>Contrato Limpa Nome</span>
              </button>
            </div>
          </div>

          {/* Área do Revendedor */}
          <div className="border-t border-white/10 pt-3">
            <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider px-3 mb-1.5">
              ÁREA DO REVENDEDOR
            </p>
            <div className="space-y-0.5">
              <button
                onClick={() => onSelectParceiroTab?.('documentos')}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                  parceiroTab === 'documentos'
                    ? 'bg-[#0c4f5d] font-bold text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4 opacity-90 shrink-0" />
                <span>Documentos de Apoio</span>
              </button>

              <button
                onClick={() => onSelectParceiroTab?.('academia')}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                  parceiroTab === 'academia'
                    ? 'bg-[#0c4f5d] font-bold text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <GraduationCap className="w-4 h-4 opacity-90 shrink-0" />
                <span>Academia Limpa Nome</span>
              </button>
            </div>
          </div>

          {/* CNPJ Inapto */}
          <div className="border-t border-white/10 pt-3">
            <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider px-3 mb-1.5">
              CNPJ INAPTO
            </p>
            <button
              onClick={() => onSelectParceiroTab?.('cnpj-inapto')}
              className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                parceiroTab === 'cnpj-inapto'
                  ? 'bg-[#0c4f5d] font-bold text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4 opacity-90 shrink-0" />
              <span>CNPJ Inapto</span>
            </button>
          </div>

          {/* Diagnóstico de Crédito */}
          <div className="border-t border-white/10 pt-3">
            <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider px-3 mb-1.5">
              DIAGNÓSTICO DE CRÉDITO
            </p>
            <div className="space-y-0.5">
              <button
                onClick={() => onSelectParceiroTab?.('solicitar-diagnostico')}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                  parceiroTab === 'solicitar-diagnostico'
                    ? 'bg-[#0c4f5d] font-bold text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Activity className="w-4 h-4 opacity-90 shrink-0" />
                <span>Solicitar Diagnóstico</span>
              </button>

              <button
                onClick={() => onSelectParceiroTab?.('meus-diagnosticos')}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                  parceiroTab === 'meus-diagnosticos'
                    ? 'bg-[#0c4f5d] font-bold text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <ClipboardList className="w-4 h-4 opacity-90 shrink-0" />
                <span>Meus Diagnósticos</span>
              </button>
            </div>
          </div>
        </nav>
      ) : (
        /* Menus do Admin e Consulta Pública */
        <nav className="flex-1 px-3 py-4 space-y-4 text-xs">
          {currentSurface === 'admin' && (
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider px-3 mb-1.5">
                PAINEL ADMINISTRATIVO
              </p>
              <button
                onClick={() => onSelectAdminTab('processos')}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                  adminTab === 'processos' || adminTab === 'registros'
                    ? 'bg-[#0c4f5d] font-bold text-white shadow-2xs'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4 opacity-90 shrink-0 text-emerald-300" />
                <span>Processos (Ações Coletivas)</span>
              </button>

              <button
                onClick={() => onSelectAdminTab('financeiro')}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                  adminTab === 'financeiro'
                    ? 'bg-[#0c4f5d] font-bold text-white shadow-2xs'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <DollarSign className="w-4 h-4 opacity-90 shrink-0 text-emerald-300" />
                <span>Financeiro & Conciliação</span>
              </button>

              <button
                onClick={() => onSelectAdminTab('operacao')}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                  adminTab === 'operacao'
                    ? 'bg-[#0c4f5d] font-bold text-white shadow-2xs'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Receipt className="w-4 h-4 opacity-90 shrink-0 text-emerald-300" />
                <span>Operação & Lotes</span>
              </button>

              <button
                onClick={() => onSelectAdminTab('controle')}
                className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                  adminTab === 'controle'
                    ? 'bg-[#0c4f5d] font-bold text-white shadow-2xs'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Lock className="w-4 h-4 opacity-90 shrink-0 text-emerald-300" />
                <span>Controle & Auditoria</span>
              </button>
            </div>
          )}

          <div className="border-t border-white/10 pt-3 space-y-0.5">
            <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider px-3 mb-1.5">
              SUPERFÍCIES
            </p>
            <button
              onClick={() => onSelectSurface('parceiro')}
              className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                currentSurface === 'parceiro'
                  ? 'bg-[#0c4f5d] font-bold text-white shadow-2xs'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 opacity-90 shrink-0" />
              <span>Portal do Parceiro (ABDCM)</span>
            </button>

            <button
              onClick={() => onSelectSurface('admin')}
              className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                currentSurface === 'admin'
                  ? 'bg-[#0c4f5d] font-bold text-white shadow-2xs'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4 opacity-90 shrink-0 text-emerald-300" />
              <span>Console Admin</span>
            </button>

            <button
              onClick={() => onSelectSurface('publico')}
              className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                currentSurface === 'publico'
                  ? 'bg-[#0c4f5d] font-bold text-white shadow-2xs'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4 opacity-90 shrink-0" />
              <span>Consulta Pública</span>
            </button>
          </div>
        </nav>
      )}

      {/* Switcher & User Card Footer */}
      <div className="p-4 border-t border-white/10 bg-[#0d5361]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
            {isParceiro ? 'Visão Parceiro' : 'Console Admin'}
          </span>
          {isParceiro ? (
            <button
              onClick={() => onSelectSurface('admin')}
              className="text-[10px] font-semibold text-emerald-300 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              Console Admin <ChevronRight className="w-3 h-3" />
            </button>
          ) : (
            <button
              onClick={() => onSelectSurface('parceiro')}
              className="text-[10px] font-semibold text-emerald-300 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              Portal Parceiro <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold uppercase shrink-0 bg-white/20 text-white border border-white/20">
            {getInitials(session?.nome || 'Admin')}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-white truncate leading-tight">
              {session?.nome || 'Administrador Geral'}
            </p>
            <p className="text-[10px] text-white/70 truncate">
              {isParceiro ? 'PARC-RDZ-001' : `Perfil: ${session?.role || 'Administrador'}`}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

