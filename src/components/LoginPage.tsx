import React, { useState } from 'react';
import { Shield, Loader2, Eye, EyeOff } from 'lucide-react';
import { UserSession } from '../server/mockData.js';
import { UserRole } from '../domain/types.js';

interface LoginPageProps {
  onAuthenticated: (session: UserSession) => void;
  onEntrarModoDemonstracao: (role: UserRole) => Promise<void>;
}

type Aba = 'entrar' | 'cadastrar';

const PAPEIS_DEMONSTRACAO: { role: UserRole; label: string }[] = [
  { role: 'parceiro', label: 'Parceiro' },
  { role: 'conciliador', label: 'Conciliador' },
  { role: 'operador', label: 'Operador de Lote' },
  { role: 'suporte', label: 'Suporte' },
  { role: 'financeiro', label: 'Financeiro' },
  { role: 'administrador', label: 'Administrador' },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onAuthenticated, onEntrarModoDemonstracao }) => {
  const [aba, setAba] = useState<Aba>('entrar');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarDemo, setMostrarDemo] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Login
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  // Cadastro
  const [nomeCadastro, setNomeCadastro] = useState('');
  const [emailCadastro, setEmailCadastro] = useState('');
  const [senhaCadastro, setSenhaCadastro] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || 'Não foi possível entrar.');
        return;
      }
      onAuthenticated(data);
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (senhaCadastro !== confirmarSenha) {
      setErro('As senhas não conferem.');
      return;
    }
    setCarregando(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeCadastro, email: emailCadastro, senha: senhaCadastro }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || 'Não foi possível cadastrar.');
        return;
      }
      onAuthenticated(data);
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  const handleDemo = async (role: UserRole) => {
    setCarregando(true);
    setErro(null);
    try {
      await onEntrarModoDemonstracao(role);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-md">
        {/* Marca */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#106778] flex items-center justify-center shadow-sm mb-3">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">ABDCM</h1>
          <p className="text-xs text-slate-500 mt-1">Associação Brasileira de Defesa do Consumidor</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Abas */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => {
                setAba('entrar');
                setErro(null);
              }}
              className={`flex-1 py-3 text-sm font-semibold transition-colors cursor-pointer ${
                aba === 'entrar'
                  ? 'text-[#106778] border-b-2 border-[#106778]'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setAba('cadastrar');
                setErro(null);
              }}
              className={`flex-1 py-3 text-sm font-semibold transition-colors cursor-pointer ${
                aba === 'cadastrar'
                  ? 'text-[#106778] border-b-2 border-[#106778]'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Cadastrar-se (Parceiro)
            </button>
          </div>

          <div className="p-6">
            {erro && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                {erro}
              </div>
            )}

            {aba === 'entrar' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">E-mail</label>
                  <input
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#106778]/30 focus:border-[#106778]"
                    placeholder="voce@exemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Senha</label>
                  <div className="relative">
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      className="w-full px-3 py-2.5 pr-10 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#106778]/30 focus:border-[#106778]"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={carregando}
                  className="w-full py-2.5 rounded-lg bg-[#106778] text-white text-sm font-semibold hover:bg-[#0d5563] transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
                >
                  {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
                  Entrar
                </button>
              </form>
            ) : (
              <form onSubmit={handleCadastro} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nome ou razão social</label>
                  <input
                    type="text"
                    required
                    value={nomeCadastro}
                    onChange={(e) => setNomeCadastro(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#106778]/30 focus:border-[#106778]"
                    placeholder="Sua empresa ou seu nome"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">E-mail</label>
                  <input
                    type="email"
                    required
                    autoComplete="username"
                    value={emailCadastro}
                    onChange={(e) => setEmailCadastro(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#106778]/30 focus:border-[#106778]"
                    placeholder="voce@exemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Senha</label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={8}
                    value={senhaCadastro}
                    onChange={(e) => setSenhaCadastro(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#106778]/30 focus:border-[#106778]"
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirmar senha</label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#106778]/30 focus:border-[#106778]"
                    placeholder="Repita a senha"
                  />
                </div>
                <button
                  type="submit"
                  disabled={carregando}
                  className="w-full py-2.5 rounded-lg bg-[#106778] text-white text-sm font-semibold hover:bg-[#0d5563] transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
                >
                  {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
                  Criar conta de parceiro
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Modo demonstração — preserva a troca de papel existente pra quem
            ainda não tem conta real (conciliador/operador/suporte/financeiro
            não têm cadastro próprio; parceiro/administrador também podem
            explorar sem criar conta). */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setMostrarDemo((v) => !v)}
            className="text-xs font-medium text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            {mostrarDemo ? 'Ocultar modo demonstração' : 'Continuar em modo demonstração, sem login'}
          </button>
          {mostrarDemo && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {PAPEIS_DEMONSTRACAO.map(({ role, label }) => (
                <button
                  key={role}
                  type="button"
                  disabled={carregando}
                  onClick={() => handleDemo(role)}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:border-[#106778] hover:text-[#106778] transition-colors cursor-pointer disabled:opacity-60"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
