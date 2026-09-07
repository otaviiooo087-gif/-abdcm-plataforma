/**
 * Servidor Express com Vite Middleware — Plataforma ABDCM
 * Conforme diretrizes de Full-Stack e Invariante I1 (nenhuma regra no cliente).
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { serverStore } from './src/server/store';
import { cleanDocument } from './src/lib/masking/documentMasker';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Limite elevado por causa do upload do contrato-modelo em base64 (padrão do
  // Express é 100kb, pequeno demais até pra um PDF simples de poucas páginas).
  app.use(express.json({ limit: '15mb' }));

  // ==========================================
  // API ROUTES (Validação estrita no servidor)
  // ==========================================

  // 1. Sessão e Troca de Papel para Testes dos 6 Perfis
  app.get('/api/auth/session', (_req: Request, res: Response) => {
    const session = serverStore.getSession();
    res.json(session);
  });

  app.post('/api/auth/switch-role', (req: Request, res: Response) => {
    const { role } = req.body;
    if (!role) {
      res.status(400).json({ error: 'Papel é obrigatório' });
      return;
    }
    const session = serverStore.setRole(role);
    res.json(session);
  });

  // 2. Lotes
  app.get('/api/lotes', async (_req: Request, res: Response) => {
    res.json(await serverStore.getLotes());
  });

  // 2.1 Atualizar configuração do lote (ex.: prazo de encerramento) — admin
  app.patch('/api/lotes/:id', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM configura as Ações Coletivas.' });
        return;
      }
      const { id } = req.params;
      const { closesAt, nome } = req.body;
      const lote = await serverStore.updateLote(id, session.id, { closesAt, nome });
      res.json(lote);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar lote';
      res.status(400).json({ error: msg });
    }
  });

  // 3. Associados
  app.get('/api/associados', async (_req: Request, res: Response) => {
    const session = serverStore.getSession();
    const todos = await serverStore.getAssociados();
    if (session.role === 'parceiro') {
      res.json(todos.filter((a) => a.parceiro_id === session.parceiro_id));
      return;
    }
    res.json(todos);
  });

  // 4. Registros
  app.get('/api/registros', async (_req: Request, res: Response) => {
    const session = serverStore.getSession();
    const todos = await serverStore.getRegistros();
    if (session.role === 'parceiro') {
      res.json(todos.filter((r) => r.parceiro_id === session.parceiro_id));
      return;
    }
    res.json(todos);
  });

  // 4.1 Cadastrar Novo Registro (Avulso)
  app.post('/api/registros', async (req: Request, res: Response) => {
    try {
      const { nome, cpf_cnpj, tipo_documento, telefone_whatsapp } = req.body;
      const novo = await serverStore.addRegistro({
        nome,
        cpf_cnpj,
        tipo_documento,
        telefone_whatsapp,
        origem: 'manual',
      });
      res.status(201).json(novo);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar registro';
      res.status(400).json({ error: msg });
    }
  });

  // 4.2 Importação em Massa de Registros (Planilha Excel/CSV)
  app.post('/api/registros/import', async (req: Request, res: Response) => {
    try {
      const { itens } = req.body;
      if (!Array.isArray(itens) || itens.length === 0) {
        res.status(400).json({ error: 'Nenhum item válido para importação.' });
        return;
      }
      const importados = [];
      for (const item of itens as Array<{ nome: string; cpf_cnpj: string }>) {
        importados.push(await serverStore.addRegistro({ nome: item.nome, cpf_cnpj: item.cpf_cnpj, origem: 'planilha' }));
      }
      res.status(201).json({ success: true, count: importados.length, importados });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro na importação';
      res.status(400).json({ error: msg });
    }
  });

  // 4.3 Excluir Registro Pendente
  app.delete('/api/registros/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await serverStore.deleteRegistro(id);
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir registro';
      res.status(400).json({ error: msg });
    }
  });

  // 4.4 Submissão de Lote para Pagamento PIX
  app.post('/api/submissoes', async (req: Request, res: Response) => {
    try {
      const { registroIds } = req.body;
      const session = serverStore.getSession();
      const result = await serverStore.submitBatch(registroIds, session.id);
      res.status(201).json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao submeter lote';
      res.status(400).json({ error: msg });
    }
  });

  // 4.5 Listar Submissões
  app.get('/api/submissoes', async (_req: Request, res: Response) => {
    res.json(await serverStore.getSubmissoes());
  });

  // 4.6 Pagar / Simular Confirmação PIX da Submissão
  app.post('/api/submissoes/:id/pagar', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const session = serverStore.getSession();
      const result = await serverStore.paySubmissao(id, session.id);
      res.json({ success: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar pagamento';
      res.status(400).json({ error: msg });
    }
  });

  // 4.6.1 Aprovar Submissão Financeira
  app.post('/api/submissoes/:id/aprovar', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { motivo } = req.body;
      const session = serverStore.getSession();
      const result = await serverStore.approveSubmissao(id, session.id, motivo);
      res.json({ success: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao aprovar submissão';
      res.status(400).json({ error: msg });
    }
  });

  // 4.6.2 Reprovar Submissão Financeira
  app.post('/api/submissoes/:id/reprovar', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { motivo } = req.body;
      const session = serverStore.getSession();
      const result = await serverStore.reproveSubmissao(id, session.id, motivo || 'Comprovante reprovado na conciliação');
      res.json({ success: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao reprovar submissão';
      res.status(400).json({ error: msg });
    }
  });

  // 4.6.3 Anexar Novo Comprovante (submissão reprovada)
  app.post('/api/submissoes/:id/comprovante', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { comprovanteBase64, mimeType } = req.body;
      const session = serverStore.getSession();
      const submissao = await serverStore.attachComprovante(
        id,
        session.id,
        comprovanteBase64,
        mimeType || 'application/octet-stream',
      );
      res.json({ success: true, submissao });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao anexar comprovante';
      res.status(400).json({ error: msg });
    }
  });

  // 4.7 Cancelar Submissão Pendente
  app.delete('/api/submissoes/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const session = serverStore.getSession();
      await serverStore.cancelSubmissao(id, session.id);
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cancelar submissão';
      res.status(400).json({ error: msg });
    }
  });

  // 5. Transição de Status (I1 & I2: Validação no servidor + ProcessEvent obrigatório)
  app.post('/api/registros/:id/transition', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { paraStatus, motivo } = req.body;
    const session = serverStore.getSession();

    try {
      if (session.role === 'suporte') {
        res.status(403).json({ error: 'Perfil de suporte não tem permissão para alterar status de registros.' });
        return;
      }
      if (session.role === 'financeiro' && paraStatus !== 'pago' && paraStatus !== 'reprovado') {
        res.status(403).json({ error: 'Perfil financeiro só pode transitar registros relacionados à conciliação de pagamento.' });
        return;
      }

      const atorTipo = session.role === 'parceiro' ? 'parceiro' : 'admin';
      const result = await serverStore.transitionStatus(
        id,
        paraStatus,
        motivo || 'Transição administrativa solicitada',
        session.id,
        atorTipo
      );

      res.json({
        success: true,
        registro: result.registro,
        processEvent: result.event,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar transição';
      res.status(400).json({ error: msg });
    }
  });

  // 6. Revelação de Documento LGPD (I6: com auditoria obrigatória)
  app.post('/api/registros/:id/reveal-doc', async (req: Request, res: Response) => {
    const { id } = req.params;
    const session = serverStore.getSession();

    try {
      const raw = await serverStore.revealDocument(id, session.id);
      res.json({ cpf_cnpj_raw: raw });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao revelar documento';
      res.status(400).json({ error: msg });
    }
  });

  // 6.1 Contestações ("Reclame Aqui")
  app.get('/api/contestacoes', async (_req: Request, res: Response) => {
    const session = serverStore.getSession();
    const todas = await serverStore.getContestacoes();
    if (session.role === 'parceiro') {
      res.json(todas.filter((c) => c.parceiro_id === session.parceiro_id));
      return;
    }
    res.json(todas);
  });

  app.post('/api/contestacoes', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      const { loteId, registroId, motivo, observacao } = req.body;
      const nova = await serverStore.createContestacao({
        loteId,
        registroId,
        motivo,
        observacao,
        parceiroId: session.parceiro_id ?? 'parc-001',
      });
      res.status(201).json(nova);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao abrir contestação';
      res.status(400).json({ error: msg });
    }
  });

  // 6.2 Catálogo de Serviços
  app.get('/api/servicos', async (_req: Request, res: Response) => {
    res.json(await serverStore.getServicos());
  });

  app.post('/api/servicos', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM cadastra serviços.' });
        return;
      }
      const { nome, descricao, preco, prazoDias, usaListas } = req.body;
      const novo = await serverStore.createServico({ nome, descricao, preco, prazoDias, usaListas });
      res.status(201).json(novo);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar serviço';
      res.status(400).json({ error: msg });
    }
  });

  app.patch('/api/servicos/:id', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM edita serviços.' });
        return;
      }
      const { id } = req.params;
      const atualizado = await serverStore.updateServico(id, req.body);
      res.json(atualizado);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar serviço';
      res.status(400).json({ error: msg });
    }
  });

  app.delete('/api/servicos/:id', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM remove serviços.' });
        return;
      }
      const { reasonCode, observacao } = req.body;
      await serverStore.deleteServico(req.params.id, session.id, reasonCode, observacao);
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao remover serviço';
      res.status(400).json({ error: msg });
    }
  });

  // 6.3 Contrato-modelo (admin anexa; parceiro só lê)
  app.get('/api/contrato', async (_req: Request, res: Response) => {
    const contrato = await serverStore.getContrato();
    res.json(contrato);
  });

  app.post('/api/contrato', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM anexa o contrato.' });
        return;
      }
      const { nomeArquivo, mimeType, conteudoBase64 } = req.body;
      const contrato = await serverStore.setContrato({ nomeArquivo, mimeType, conteudoBase64 });
      res.status(201).json(contrato);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao anexar contrato';
      res.status(400).json({ error: msg });
    }
  });

  // 7. Timeline / ProcessEvents do Registro (I2)
  app.get('/api/registros/:id/timeline', async (req: Request, res: Response) => {
    const { id } = req.params;
    const eventos = await serverStore.getProcessEvents();
    res.json(eventos.filter((pe) => pe.registro_id === id));
  });

  // 8. Trilha de Auditoria (Imutável)
  app.get('/api/audit', async (_req: Request, res: Response) => {
    const session = serverStore.getSession();
    if (session.role !== 'administrador') {
      res.status(403).json({ error: 'Apenas administradores podem visualizar o log de auditoria completo.' });
      return;
    }
    res.json(await serverStore.getAuditLogs());
  });

  // 9. Consulta Pública (sem login, CPF + Protocolo)
  app.post('/api/consulta', async (req: Request, res: Response) => {
    const { cpf_cnpj, protocol_code } = req.body;
    if (!cpf_cnpj && !protocol_code) {
      res.status(400).json({ error: 'Informe o CPF/CNPJ ou o Número do Protocolo.' });
      return;
    }

    const cleanInputDoc = cleanDocument(cpf_cnpj || '');
    const cleanInputProt = (protocol_code || '').trim().toUpperCase();

    const [registros, lotes, processEvents] = await Promise.all([
      serverStore.getRegistros(),
      serverStore.getLotes(),
      serverStore.getProcessEvents(),
    ]);

    const matched = registros.filter((reg) => {
      const matchDoc = cleanInputDoc && cleanDocument(reg.cpf_cnpj_raw) === cleanInputDoc;
      const matchProt = cleanInputProt && reg.protocol_code && reg.protocol_code.toUpperCase() === cleanInputProt;
      return matchDoc || matchProt;
    });

    if (matched.length === 0) {
      res.status(404).json({ error: 'Nenhum processo localizado para os dados informados.' });
      return;
    }

    const results = matched.map((reg) => {
      const lote = lotes.find((l) => l.id === reg.lote_id);
      const timeline = processEvents
        .filter((pe) => pe.registro_id === reg.id)
        .map((pe) => ({
          de_status: pe.de_status,
          para_status: pe.para_status,
          motivo: pe.motivo,
          ocorrido_em: pe.ocorrido_em,
        }));

      return {
        id: reg.id,
        nome: reg.nome,
        cpf_cnpj_mascarado: reg.cpf_cnpj,
        protocol_code: reg.protocol_code || 'Em processamento',
        lote_nome: lote?.nome || 'Lote Não Identificado',
        process_status: reg.process_status,
        enviado_em: reg.enviado_em,
        protocolado_em: reg.protocolado_em,
        baixado_em: reg.baixado_em,
        timeline,
      };
    });

    res.json({ results });
  });

  // ==========================================
  // VITE MIDDLEWARE SETUP
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ABDCM] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
