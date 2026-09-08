/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { ParceiroPortal } from './components/ParceiroPortal.js';
import { AdminConsole } from './components/AdminConsole.js';
import { ConsultaPublica } from './components/ConsultaPublica.js';
import { TimelineModal } from './components/TimelineModal.js';
import { TransitionModal } from './components/TransitionModal.js';
import { LoginPage } from './components/LoginPage.js';
import { LoteConcluidoCelebration } from './components/LoteConcluidoCelebration.js';
import { ProcessoToasts } from './components/ProcessoToasts.js';
import { Lote, Registro, Associado, Submissao, AuditLog, UserRole } from './domain/types.js';
import { UserSession } from './server/mockData.js';

const DEMO_MODE_KEY = 'abdcm_modo_demonstracao';

export default function App() {
  const [currentSurface, setCurrentSurface] = useState<'parceiro' | 'admin' | 'publico'>('parceiro');
  const [parceiroTab, setParceiroTab] = useState<string>('home');
  const [adminTab, setAdminTab] = useState<
    | 'dashboard'
    | 'processos'
    | 'associados'
    | 'financeiro'
    | 'servicos'
    | 'eventos'
    | 'automacoes'
    | 'config'
    | 'controle'
  >('dashboard');
  const [session, setSession] = useState<UserSession | null>(null);
  const [demoModeChosen, setDemoModeChosen] = useState<boolean>(
    () => sessionStorage.getItem(DEMO_MODE_KEY) === '1',
  );
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [associados, setAssociados] = useState<Associado[]>([]);
  const [submissoes, setSubmissoes] = useState<Submissao[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificacoes, setNotificacoes] = useState<
    { id: string; titulo: string; mensagem: string; ocorridoEm: string; lida: boolean }[]
  >([]);

  // Modals
  const [timelineRegistro, setTimelineRegistro] = useState<Registro | null>(null);
  const [transitionRegistro, setTransitionRegistro] = useState<Registro | null>(null);

  const loadData = () => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => setSession(data))
      .catch((err) => console.error('Erro ao carregar sessão:', err))
      .finally(() => setSessionLoaded(true));

    fetch('/api/lotes')
      .then((res) => res.json())
      .then((data) => setLotes(data))
      .catch((err) => console.error('Erro ao carregar lotes:', err));

    fetch('/api/registros')
      .then((res) => res.json())
      .then((data) => setRegistros(data))
      .catch((err) => console.error('Erro ao carregar registros:', err));

    fetch('/api/associados')
      .then((res) => res.json())
      .then((data) => setAssociados(data))
      .catch((err) => console.error('Erro ao carregar associados:', err));

    fetch('/api/audit')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAuditLogs(data))
      .catch(() => setAuditLogs([]));

    fetch('/api/submissoes')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSubmissoes(data))
      .catch(() => setSubmissoes([]));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Atualização periódica de lotes/registros — é o que alimenta os toasts
  // de mudança de status (ProcessoToasts) e a checagem de lote concluído
  // (LoteConcluidoCelebration) com dado que pode ter mudado sem o usuário
  // ter feito nada na tela (ex.: admin protocolou, birô deu baixa).
  useEffect(() => {
    if (!sessionLoaded || (!session?.autenticado && !demoModeChosen)) return;
    const interval = setInterval(() => {
      fetch('/api/lotes')
        .then((res) => res.json())
        .then(setLotes)
        .catch(() => {});
      fetch('/api/registros')
        .then((res) => res.json())
        .then(setRegistros)
        .catch(() => {});
    }, 20000);
    return () => clearInterval(interval);
  }, [sessionLoaded, session?.autenticado, demoModeChosen]);

  // Tempo real: o servidor avisa por SSE assim que algo muda (pagamento
  // confirmado, lote encerrado, órgão deu baixa...) e a gente recarrega na
  // hora, em vez de esperar até 20s do poll acima — que continua existindo
  // como rede de segurança (reconexão de aba, evento perdido). Um evento
  // nunca carrega o dado em si, só avisa "algo mudou" — quem decide o que
  // esta sessão pode ver continua sendo a rota GET de sempre (I1).
  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;
  useEffect(() => {
    if (!sessionLoaded || (!session?.autenticado && !demoModeChosen)) return;

    const source = new EventSource('/api/eventos/stream');
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const recarregarLogo = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => loadDataRef.current(), 250);
    };

    source.onmessage = (ev) => {
      try {
        const evento = JSON.parse(ev.data) as {
          categoria: string;
          notificacao?: { titulo: string; mensagem: string };
        };
        recarregarLogo();
        if (evento.notificacao) {
          setNotificacoes((prev) =>
            [
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                titulo: evento.notificacao!.titulo,
                mensagem: evento.notificacao!.mensagem,
                ocorridoEm: new Date().toISOString(),
                lida: false,
              },
              ...prev,
            ].slice(0, 20),
          );
        }
      } catch {
        // evento malformado — ignora, o poll de 20s ainda garante consistência
      }
    };
    source.onerror = () => {
      // EventSource já reconecta sozinho por padrão — nada a fazer aqui
      // além de deixar o poll de 20s como rede de segurança nesse meio-tempo.
    };

    return () => {
      if (debounce) clearTimeout(debounce);
      source.close();
    };
  }, [sessionLoaded, session?.autenticado, demoModeChosen]);

  const handleSwitchRole = async (role: UserRole) => {
    try {
      const res = await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const updated = await res.json();
      setSession(updated);
      loadData();
    } catch (err) {
      console.error('Erro ao alterar papel:', err);
    }
  };

  const handleAuthenticated = (novaSessao: UserSession) => {
    setSession(novaSessao);
    loadData();
  };

  const handleEntrarModoDemonstracao = async (role: UserRole) => {
    await handleSwitchRole(role);
    sessionStorage.setItem(DEMO_MODE_KEY, '1');
    setDemoModeChosen(true);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
    sessionStorage.removeItem(DEMO_MODE_KEY);
    setDemoModeChosen(false);
    setSession(null);
    loadData();
  };

  // A troca de superfície (Portal do Parceiro / Console Admin / Consulta
  // Pública) é só navegação de tela — não muda o papel da sessão sozinha.
  // Sem isso, entrar no Console Admin com o papel ainda em "parceiro" (o
  // padrão) faz toda ação administrativa (ex.: criar Ação Coletiva) ser
  // barrada pelo servidor com 403, o que parece bug e não é: o seletor
  // "Papel" no header existe justamente pra escolher entre os papéis da
  // equipe ABDCM ao testar o Console Admin.
  const handleSelectSurface = (surface: 'parceiro' | 'admin' | 'publico') => {
    setCurrentSurface(surface);
    if (surface === 'admin' && session?.role === 'parceiro') {
      handleSwitchRole('administrador');
    }
  };

  // Filtragem de busca
  const filteredRegistros = registros.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.nome || '').toLowerCase().includes(q) ||
      (r.cpf_cnpj || '').toLowerCase().includes(q) ||
      (r.protocol_code && r.protocol_code.toLowerCase().includes(q))
    );
  });

  // Gate de acesso: sem sessão real (login) nem modo demonstração escolhido,
  // mostra a tela de login/cadastro em vez do app. Enquanto a primeira
  // checagem de sessão não voltou, não renderiza nada pra evitar flash da
  // tela de login antes de saber se já existe um cookie válido.
  if (!sessionLoaded) {
    return <div className="min-h-screen w-full bg-[#F8FAFC]" />;
  }
  if (!session?.autenticado && !demoModeChosen) {
    return (
      <LoginPage
        onAuthenticated={handleAuthenticated}
        onEntrarModoDemonstracao={handleEntrarModoDemonstracao}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#F8FAFC] font-sans text-[#1E293B] overflow-hidden">
      {/* 1. Sidebar com Tema Professional Polish */}
      <Sidebar
        currentSurface={currentSurface}
        onSelectSurface={handleSelectSurface}
        adminTab={adminTab}
        onSelectAdminTab={setAdminTab}
        parceiroTab={parceiroTab}
        onSelectParceiroTab={setParceiroTab}
        session={session}
      />

      {/* 2. Conteúdo Principal */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          currentSurface={currentSurface}
          onSwitchSurface={handleSelectSurface}
          session={session}
          onSwitchRole={handleSwitchRole}
          onLogout={handleLogout}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          notificacoes={notificacoes}
          onAbrirNotificacoes={() => setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))}
        />

        {/* Superfícies */}
        {currentSurface === 'parceiro' && (
          <ParceiroPortal
            lotes={lotes}
            registros={filteredRegistros}
            associados={associados}
            parceiroTab={parceiroTab}
            session={session}
            onSelectParceiroTab={setParceiroTab}
            onOpenTimeline={(reg) => setTimelineRegistro(reg)}
            onRefreshData={loadData}
          />
        )}

        {currentSurface === 'admin' && (
          <AdminConsole
            activeTab={adminTab}
            onSelectTab={setAdminTab}
            lotes={lotes}
            registros={filteredRegistros}
            associados={associados}
            submissoes={submissoes}
            auditLogs={auditLogs}
            session={session}
            onOpenTimeline={(reg) => setTimelineRegistro(reg)}
            onOpenTransition={(reg) => setTransitionRegistro(reg)}
            onRefreshData={loadData}
          />
        )}

        {currentSurface === 'publico' && <ConsultaPublica />}
      </main>

      {/* Modais de Timeline e Transição (I2, I11) */}
      <TimelineModal
        registro={timelineRegistro}
        onClose={() => setTimelineRegistro(null)}
      />

      <TransitionModal
        registro={transitionRegistro}
        onClose={() => setTransitionRegistro(null)}
        onSuccess={() => {
          setTransitionRegistro(null);
          loadData();
        }}
      />

      {/* Comemoração de lote concluído + toasts de mudança de status —
          só fazem sentido pro parceiro, que é quem acompanha "seus" nomes */}
      {session?.role === 'parceiro' && (
        <>
          <LoteConcluidoCelebration
            lotes={lotes}
            registros={registros}
            parceiroId={session?.parceiro_id}
            onEmitirNadaConsta={() => {
              setCurrentSurface('parceiro');
              setParceiroTab('minhas-listas');
            }}
          />
          <ProcessoToasts registros={registros} parceiroId={session?.parceiro_id} />
        </>
      )}
    </div>
  );
}
