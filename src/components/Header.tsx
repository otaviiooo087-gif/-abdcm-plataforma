import React, { useState } from 'react';
import { UserRole } from '../domain/types.js';
import { UserSession } from '../server/mockData.js';
import { Shield, Bell, HelpCircle, Users, Menu, User, Layers, ArrowLeftRight, LogOut, X } from 'lucide-react';

interface NotificacaoHeader {
  id: string;
  titulo: string;
  mensagem: string;
  ocorridoEm: string;
  lida: boolean;
}

interface HeaderProps {
  currentSurface: 'parceiro' | 'admin' | 'publico';
  onSwitchSurface?: (surface: 'parceiro' | 'admin' | 'publico') => void;
  session: UserSession | null;
  onSwitchRole: (role: UserRole) => void;
  onLogout?: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  notificacoes?: NotificacaoHeader[];
  onAbrirNotificacoes?: () => void;
}

function tempoRelativo(iso: string): string {
  const segundos = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (segundos < 60) return 'agora';
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  return `há ${Math.floor(horas / 24)}d`;
}

export const Header: React.FC<HeaderProps> = ({
  currentSurface,
  onSwitchSurface,
  session,
  onSwitchRole,
  onLogout,
  notificacoes = [],
  onAbrirNotificacoes,
}) => {
  const [sinoAberto, setSinoAberto] = useState(false);
  const naoLidas = notificacoes.filter((n) => !n.lida).length;
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
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer abdcm-glow"
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
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer abdcm-glow ${
              currentSurface === 'parceiro'
                ? 'bg-white text-[#106778] font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Portal do Parceiro
          </button>
          <button
            onClick={() => onSwitchSurface?.('admin')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer abdcm-glow ${
              currentSurface === 'admin'
                ? 'bg-white text-[#106778] font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Console Admin
          </button>
          <button
            onClick={() => onSwitchSurface?.('publico')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer abdcm-glow ${
              currentSurface === 'publico'
                ? 'bg-white text-[#106778] font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Consulta Pública
          </button>
        </div>

        {/* Role Simulator (Admin only) — só no modo demonstração; com login
            real (session.autenticado) o papel vem da conta, não se troca */}
        {currentSurface === 'admin' && !session?.autenticado && (
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

        {/* Sino de Notificações — eventos em tempo real desta sessão (SSE) */}
        <div className="relative">
          <button
            title="Notificações"
            onClick={() => {
              const abrindo = !sinoAberto;
              setSinoAberto(abrindo);
              if (abrindo) onAbrirNotificacoes?.();
            }}
            className="relative p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer abdcm-glow"
          >
            <Bell className="w-4.5 h-4.5" />
            {naoLidas > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {naoLidas > 9 ? '9+' : naoLidas}
              </span>
            )}
          </button>

          {sinoAberto && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSinoAberto(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Notificações</span>
                  <button onClick={() => setSinoAberto(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notificacoes.length === 0 ? (
                    <p className="px-4 py-8 text-center text-xs text-slate-400">
                      Nenhuma notificação por enquanto — avisos de pagamento, lote e status aparecem aqui na hora.
                    </p>
                  ) : (
                    notificacoes.map((n) => (
                      <div key={n.id} className="px-4 py-3 hover:bg-slate-50">
                        <p className="text-xs font-bold text-slate-800">{n.titulo}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{n.mensagem}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{tempoRelativo(n.ocorridoEm)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

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
          {session?.autenticado && onLogout && (
            <button
              title="Sair"
              onClick={onLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-600 transition-colors cursor-pointer abdcm-glow"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

