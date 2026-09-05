/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { ParceiroPortal } from './components/ParceiroPortal.js';
import { AdminConsole } from './components/AdminConsole.js';
import { ConsultaPublica } from './components/ConsultaPublica.js';
import { TimelineModal } from './components/TimelineModal.js';
import { TransitionModal } from './components/TransitionModal.js';
import { Lote, Registro, Associado, Submissao, AuditLog, UserRole } from './domain/types.js';
import { UserSession } from './server/mockData.js';

export default function App() {
  const [currentSurface, setCurrentSurface] = useState<'parceiro' | 'admin' | 'publico'>('parceiro');
  const [parceiroTab, setParceiroTab] = useState<string>('home');
  const [adminTab, setAdminTab] = useState<'processos' | 'financeiro' | 'operacao' | 'controle'>('processos');
  const [session, setSession] = useState<UserSession | null>(null);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [associados, setAssociados] = useState<Associado[]>([]);
  const [submissoes, setSubmissoes] = useState<Submissao[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [timelineRegistro, setTimelineRegistro] = useState<Registro | null>(null);
  const [transitionRegistro, setTransitionRegistro] = useState<Registro | null>(null);

  const loadData = () => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => setSession(data))
      .catch((err) => console.error('Erro ao carregar sessão:', err));

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

  return (
    <div className="flex h-screen w-screen bg-[#F8FAFC] font-sans text-[#1E293B] overflow-hidden">
      {/* 1. Sidebar com Tema Professional Polish */}
      <Sidebar
        currentSurface={currentSurface}
        onSelectSurface={setCurrentSurface}
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
          onSwitchSurface={setCurrentSurface}
          session={session}
          onSwitchRole={handleSwitchRole}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
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
    </div>
  );
}
