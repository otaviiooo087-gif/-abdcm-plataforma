import React, { useState, useEffect } from 'react';
import {
  Clock,
  Check,
  ShieldCheck,
  Zap,
  User,
  MessageCircle,
  FileText,
  TrendingUp,
  Search,
  FileCheck,
  UserCheck,
  HelpCircle,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { Lote, Registro } from '../../domain/types.js';

interface HomeViewProps {
  session?: {
    nome?: string;
    email?: string;
    role?: string;
  } | null;
  loteVigente?: Lote;
  registros: Registro[];
  onNavigateTab: (tab: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  session,
  loteVigente,
  registros,
  onNavigateTab,
}) => {
  // Saudação dinâmica conforme o horário do dia
  const [greeting, setGreeting] = useState('Boa tarde');
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Bom dia');
    else if (hour < 18) setGreeting('Boa tarde');
    else setGreeting('Boa noite');
  }, []);

  // Contagem regressiva ativa para o prazo de encerramento do lote (19:00)
  const [timeLeft, setTimeLeft] = useState({
    dias: '00',
    horas: '05',
    minutos: '06',
    segundos: '22',
  });

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      // Target: hoje às 19:00 ou próxima data de fechamento
      const target = new Date();
      target.setHours(19, 0, 0, 0);

      // Se já passou das 19:00 de hoje, aponta para amanhã às 19:00
      if (now.getTime() >= target.getTime()) {
        target.setDate(target.getDate() + 1);
      }

      const diff = Math.max(0, target.getTime() - now.getTime());
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({
        dias: '00',
        horas: String(hours).padStart(2, '0'),
        minutos: String(minutes).padStart(2, '0'),
        segundos: String(seconds).padStart(2, '0'),
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const totalNomes = registros.length || 19;
  const partnerName = session?.nome || 'Rdz Consultoria Financeira';
  const nomeLote = loteVigente?.nome || 'AÇÃO COLETIVA 124';

  const whatsappUrl =
    'https://wa.me/5511999999999?text=Olá,%20preciso%20de%20ajuda%20no%20Portal%20do%20Parceiro%20ABDCM';

  return (
    <div className="p-8 space-y-6 overflow-y-auto flex-1 relative bg-[#F8FAFC]">
      {/* 1. Header com Saudação */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          {greeting}, {partnerName}! 👋
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Gerencie e acompanhe seus nomes enviados para nossa ação coletiva Limpa Nome
        </p>
      </div>

      {/* 2. Top Banners (WhatsApp Suporte + Diagnóstico Score) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Banner 1: SUPORTE NO WHATSAPP */}
        <div className="bg-gradient-to-br from-emerald-50/90 via-teal-50/70 to-cyan-50/80 border border-teal-200/70 rounded-2xl p-6 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          {/* Fundo decorativo sutil com formas vetoriais */}
          <div className="absolute -right-6 -bottom-10 w-48 h-48 bg-teal-200/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute right-8 top-6 opacity-10 pointer-events-none">
            <Check className="w-28 h-28 text-teal-700 stroke-[4]" />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
            {/* Simulação gráfica minimalista do smartphone/atendimento sem fotos externas */}
            <div className="w-36 h-48 bg-white rounded-2xl border-2 border-teal-500/30 shadow-md p-2.5 flex flex-col justify-between shrink-0">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-extrabold text-teal-800 tracking-wider uppercase">ABDCM</span>
                <div className="w-2 h-2 rounded-full bg-slate-200" />
              </div>
              <div className="space-y-1.5 my-auto">
                <div className="bg-teal-50 rounded-lg p-2 text-[9px] text-teal-900 font-medium leading-tight border border-teal-100">
                  Olá! Como podemos ajudar sua consultoria hoje?
                </div>
                <div className="bg-emerald-500 text-white rounded-lg p-1.5 text-[9px] font-semibold text-right ml-auto max-w-[85%]">
                  Dúvidas sobre o lote 124
                </div>
              </div>
              <div className="pt-1 flex items-center justify-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 rounded-md py-1">
                <MessageCircle className="w-3 h-3 fill-emerald-600 text-white" />
                Atendimento Ativo
              </div>
            </div>

            {/* Conteúdo textual e badges */}
            <div className="space-y-3 flex-1 text-center sm:text-left">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
                  Canal Oficial
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none mt-0.5">
                  SUPORTE NO{' '}
                  <span className="text-[#106778] inline-flex items-center gap-1.5">
                    WHATSAPP
                    <span className="w-7 h-7 bg-[#25D366] rounded-full inline-flex items-center justify-center text-white shadow-2xs">
                      <MessageCircle className="w-4 h-4 fill-white" />
                    </span>
                  </span>
                </h2>
                <p className="text-xs text-slate-600 mt-2 font-normal leading-relaxed">
                  Atendimento rápido, prático e humanizado para te ajudar{' '}
                  <strong className="text-slate-800 font-semibold">sempre que precisar.</strong>
                </p>
              </div>

              {/* 3 Badges */}
              <div className="flex flex-wrap gap-2 pt-1 justify-center sm:justify-start">
                <div className="flex items-center gap-1.5 bg-white/90 border border-teal-200 px-2.5 py-1 rounded-full text-[11px] font-medium text-slate-700 shadow-2xs">
                  <div className="w-4 h-4 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center">
                    <Zap className="w-2.5 h-2.5 fill-current" />
                  </div>
                  <span>Respostas rápidas</span>
                </div>

                <div className="flex items-center gap-1.5 bg-white/90 border border-teal-200 px-2.5 py-1 rounded-full text-[11px] font-medium text-slate-700 shadow-2xs">
                  <div className="w-4 h-4 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center">
                    <User className="w-2.5 h-2.5" />
                  </div>
                  <span>Atendimento humanizado</span>
                </div>

                <div className="flex items-center gap-1.5 bg-white/90 border border-teal-200 px-2.5 py-1 rounded-full text-[11px] font-medium text-slate-700 shadow-2xs">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <ShieldCheck className="w-2.5 h-2.5" />
                  </div>
                  <span>Confiança e segurança</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Banner 2: NOME LIMPO E NÃO CONSEGUE CRÉDITO? */}
        <div className="bg-gradient-to-br from-slate-50 via-sky-50/50 to-blue-50/70 border border-blue-200/70 rounded-2xl p-6 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                  NOME LIMPO E <br className="hidden sm:block" />
                  <span className="text-sky-600">NÃO CONSEGUE CRÉDITO?</span>
                </h2>
                <p className="text-xs text-slate-600 mt-1 font-normal">
                  A solução é o nosso{' '}
                  <strong className="text-slate-800 font-semibold">
                    Raio-X + Diagnóstico de Crédito + Análise do Especialista.
                  </strong>
                </p>
              </div>

              {/* Indicador de Score em Gauge / SVG limpo */}
              <div className="shrink-0 bg-white/95 p-3 rounded-xl border border-sky-100 shadow-2xs flex flex-col items-center">
                <div className="relative w-28 h-14 flex items-end justify-center overflow-hidden">
                  <svg viewBox="0 0 100 50" className="w-28 h-14">
                    {/* Arcos do score: Vermelho, Amarelo, Verde */}
                    <path
                      d="M 10 50 A 40 40 0 0 1 30 18"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="9"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 32 16 A 40 40 0 0 1 68 16"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="9"
                    />
                    <path
                      d="M 70 18 A 40 40 0 0 1 90 50"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="9"
                      strokeLinecap="round"
                    />
                    {/* Ponteiro */}
                    <line x1="50" y1="50" x2="72" y2="28" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="50" cy="50" r="4" fill="#1e293b" />
                  </svg>
                </div>
                <div className="flex justify-between w-full text-[8px] font-bold text-slate-400 px-1 mt-0.5">
                  <span className="text-red-500">BAIXO</span>
                  <span className="text-amber-500">BOM</span>
                  <span className="text-emerald-500">EXCELENTE</span>
                </div>
                <span className="text-[10px] font-black text-slate-800 tracking-wider mt-1">SCORE</span>
              </div>
            </div>

            {/* 3 Passos: RAIO-X / DIAGNÓSTICO / ANÁLISE */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div className="bg-white/90 p-2.5 rounded-xl border border-sky-100/90 shadow-2xs flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-slate-900 uppercase">RAIO-X</h4>
                  <p className="text-[10px] text-slate-500 leading-tight">Identificamos o que está te impedindo.</p>
                </div>
              </div>

              <div className="bg-white/90 p-2.5 rounded-xl border border-sky-100/90 shadow-2xs flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-slate-900 uppercase">DIAGNÓSTICO</h4>
                  <p className="text-[10px] text-slate-500 leading-tight">Entenda seu cenário de crédito atual.</p>
                </div>
              </div>

              <div className="bg-white/90 p-2.5 rounded-xl border border-sky-100/90 shadow-2xs flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-slate-900 uppercase">ANÁLISE DO ESP.</h4>
                  <p className="text-[10px] text-slate-500 leading-tight">Orientação estratégica para avançar.</p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Rodapé do Banner */}
          <div className="mt-3 pt-3 border-t border-sky-200/50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-600 font-medium">
              Recupere seu poder de compra e conquiste seus objetivos!
            </p>
            <button
              onClick={() => onNavigateTab('solicitar-diagnostico')}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <span>FALE COM A GENTE!</span>
              <MessageCircle className="w-3.5 h-3.5 fill-white" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Prazo de Encerramento + Lista Ativa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Prazo de Encerramento */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-slate-900">Prazo de Encerramento</h3>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Lista <strong className="text-slate-800 font-bold">{nomeLote}</strong>
            </p>

            {/* Contadores Digitais */}
            <div className="grid grid-cols-4 gap-3 mt-4">
              <div className="bg-[#F0F7FB] border border-[#E0EFF8] rounded-xl p-3 text-center">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono block">
                  {timeLeft.dias}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-1">
                  DIAS
                </span>
              </div>

              <div className="bg-[#F0F7FB] border border-[#E0EFF8] rounded-xl p-3 text-center">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono block">
                  {timeLeft.horas}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-1">
                  HORAS
                </span>
              </div>

              <div className="bg-[#F0F7FB] border border-[#E0EFF8] rounded-xl p-3 text-center">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono block">
                  {timeLeft.minutos}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-1">
                  MIN
                </span>
              </div>

              <div className="bg-[#F0F7FB] border border-[#E0EFF8] rounded-xl p-3 text-center">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono block">
                  {timeLeft.segundos}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-1">
                  SEG
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500">
            Encerra dia 04/09 às 19:00h
          </div>
        </div>

        {/* Card 2: Lista Ativa */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900">Lista Ativa</h3>
            </div>

            <div className="flex items-center justify-between mt-3">
              <h4 className="text-base font-extrabold text-slate-900">{nomeLote}</h4>
              <span className="px-3 py-1 bg-emerald-600 text-white rounded-full text-xs font-semibold shadow-2xs">
                Aguardando encerramento
              </span>
            </div>

            {/* Badges estilizados dos 4 Birôs de Crédito (Serasa Experian, Boa Vista, SPC Brasil, CENPROT) */}
            <div className="grid grid-cols-4 gap-2.5 mt-5">
              {/* Serasa Experian */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex flex-col items-center justify-center text-center h-16">
                <div className="flex items-center gap-0.5 mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E02479]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0284C7]" />
                  <span className="text-xs font-extrabold text-[#7C3AED] ml-0.5">serasa</span>
                </div>
                <span className="text-[9px] text-slate-500 font-medium">experian.</span>
              </div>

              {/* Boa Vista SCPC */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex flex-col items-center justify-center text-center h-16">
                <span className="text-xs font-black text-[#0B4F8C]">BoaVista</span>
                <span className="text-[9px] font-bold text-[#0B4F8C] bg-sky-100/80 px-1.5 py-0.2 rounded mt-0.5">
                  SCPC
                </span>
              </div>

              {/* SPC Brasil */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex flex-col items-center justify-center text-center h-16">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 bg-amber-400 rotate-45 rounded-2xs" />
                  <span className="text-xs font-extrabold text-slate-800">SPC</span>
                </div>
                <span className="text-[9px] font-semibold text-slate-600">BRASIL</span>
              </div>

              {/* CENPROT */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex flex-col items-center justify-center text-center h-16">
                <div className="w-4 h-4 rounded-sm bg-gradient-to-tr from-[#1E3A8A] to-[#3B82F6] flex items-center justify-center text-[9px] text-white font-bold mb-0.5">
                  C
                </div>
                <span className="text-[10px] font-black text-slate-800 tracking-wider">CENPROT</span>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <span className="text-xs text-slate-500 font-medium block">
              {totalNomes} nomes cadastrados
            </span>
            {/* Barra de Progresso Verde */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full w-[78%] transition-all duration-500" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Ações Rápidas */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-slate-900">Ações Rápidas</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Ação 1: Gerenciar Listas */}
          <button
            onClick={() => onNavigateTab('enviar-limpa-nome')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-sky-300 hover:shadow-xs transition-all flex items-center gap-4 text-left group cursor-pointer"
          >
            <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 group-hover:scale-105 transition-transform shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                Gerenciar Listas
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Enviar e acompanhar nomes</p>
            </div>
          </button>

          {/* Ação 2: Financeiro */}
          <button
            onClick={() => onNavigateTab('financeiro')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition-all flex items-center gap-4 text-left group cursor-pointer"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition-transform shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                Financeiro
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Pagamentos e comprovantes</p>
            </div>
          </button>

          {/* Ação 3: Suporte */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition-all flex items-center gap-4 text-left group cursor-pointer"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition-transform shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                Suporte
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Fale conosco via WhatsApp</p>
            </div>
          </a>
        </div>
      </div>

      {/* 5. Botão Flutuante 'Precisa de ajuda?' no canto inferior direito */}
      <div className="fixed bottom-6 right-6 z-40">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 bg-[#198754] hover:bg-[#157347] text-white px-5 py-3 rounded-full shadow-lg font-bold text-xs cursor-pointer transition-all hover:scale-105"
        >
          <MessageCircle className="w-4 h-4 fill-white" />
          <span>Precisa de ajuda?</span>
        </a>
      </div>
    </div>
  );
};
