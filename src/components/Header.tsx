import React from 'react';
import { UserRole } from '../domain/types.js';
import { UserSession } from '../server/mockData.js';
import { Shield, Bell, HelpCircle, Users, Menu, User, Layers, ArrowLeftRight } from 'lucide-react';

interface HeaderProps {
  currentSurface: 'parceiro' | 'admin' | 'publico';
  onSwitchSurface?: (surface: 'parceiro' | 'admin' | 'publico') => void;
  session: UserSession | null;
  onSwitchRole: (role: UserRole) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSurface,
  onSwitchSurface,
  session,
  onSwitchRole,
}) => {
  const getSurfaceLabel = () => {
    switch (currentSurface) {
      case 'admin':
        return {
          title: 'Console Admin',
          badge: 'Administração & Operação',
        };
      case 'publico':
        return {
          title: 'Consulta Pública',
          badge: 'Pesquisa de Processos',
        };
      default:
        return {
          title: 'Portal do Parceiro',
          badge: 'Credenciado ABDCM',
        };
    }
  };

  const { title, badge } = getSurfaceLabel();

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-2xs">
      {/* Left Brand Title & Surface context */}
      <div className="flex items-center gap-3">
        <button
          title="Menu de Navegação"
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-900 tracking-tight">
            ABDCM
          </span>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-semibold text-[#106778]">
            {title}
          </span>
          <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
            {badge}
          </span>
        </div>
      </div>

      {/* Right Tools & User Info */}
      <div className="flex items-center gap-3.5">
        {/* Surface Switcher Pill */}
        <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
          <button
            onClick={() => onSwitchSurface?.('parceiro')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              currentSurface === 'parceiro'
                ? 'bg-white text-[#106778] font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Portal do Parceiro
          </button>
          <button
            onClick={() => onSwitchSurface?.('admin')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              currentSurface === 'admin'
                ? 'bg-white text-[#106778] font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Console Admin
          </button>
          <button
            onClick={() => onSwitchSurface?.('publico')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              currentSurface === 'publico'
                ? 'bg-white text-[#106778] font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Consulta Pública
          </button>
        </div>

        {/* Role Simulator (Admin only) */}
        {currentSurface === 'admin' && (
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs">
            <Users className="w-3.5 h-3.5 text-[#106778]" />
            <span className="text-[11px] font-medium text-slate-500">Papel:</span>
            <select
              value={session?.role || 'administrador'}
              onChange={(e) => onSwitchRole(e.target.value as UserRole)}
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer text-xs uppercase"
            >
              <option value="administrador">Administrador</option>
              <option value="conciliador">Conciliador</option>
              <option value="operador">Operador de Lote</option>
              <option value="suporte">Suporte</option>
              <option value="financeiro">Financeiro</option>
            </select>
          </div>
        )}

        {/* User Profile Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-7 h-7 rounded-full bg-[#106778]/10 text-[#106778] flex items-center justify-center font-bold text-xs shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="text-left hidden md:block">
            <span className="text-xs font-bold text-slate-800 block leading-tight">
              {currentSurface === 'admin'
                ? (session?.nome || 'Administrador Geral')
                : (session?.nome || 'Rdz Consultoria Financeira')}
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              {currentSurface === 'admin' ? `Acesso: ${session?.role || 'Administrador'}` : 'Parceiro Credenciado'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

