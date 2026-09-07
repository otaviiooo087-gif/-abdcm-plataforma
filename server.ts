/**
 * Servidor Express com Vite Middleware — Plataforma ABDCM
 * Conforme diretrizes de Full-Stack e Invariante I1 (nenhuma regra no cliente).
 */

import { config } from 'dotenv';
import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { serverStore } from './src/server/store';
import { cleanDocument } from './src/lib/masking/documentMasker';
import { avisarStatusProcesso, rodarAutomacoes } from './src/server/notificacoes';
import { pixProviderConfigurado } from './src/integrations/pix/index';
import { whatsAppProviderConfigurado } from './src/integrations/whatsapp/index';
import { storageProviderConfigurado, caminhoLocalSeguro } from './src/integrations/storage/index';
import type { Registro } from './src/domain/types';
import { promises as fs } from 'node:fs';

/** Dispara avisos de status por WhatsApp sem segurar a resposta HTTP — falha vira só um log. */
function dispararAvisosDeStatus(registros: Registro[], novoStatus: string): void {
  for (const registro of registros) {
    avisarStatusProcesso(registro, novoStatus).catch((err) => {
      console.error(`[automacoes] falha ao avisar status "${novoStatus}" do registro ${registro.id}:`, err);
    });
  }
}

// Em produção o DATABASE_URL (e demais segredos) vem de variável de ambiente
// real da plataforma de deploy — I10. Em dev local, carrega do .env.local.
if (process.env.NODE_ENV !== 'production') {
  config({ path: '.env.local' });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Limite elevado por causa do upload do contrato-modelo em base64 (padrão do
  // Express é 100kb, pequeno demais até pra um PDF simples de poucas páginas).
  app.use(express.json({ limit: '15mb' }));

  // Rotas de armazenamento mock (só existem quando não há R2 configurado —
  // ver src/integrations/storage). Simulam PUT/GET assinado guardando em
  // disco local, só pra testar o fluxo com poucos arquivos em dev; em
  // produção com R2 configurado o navegador nunca passa por aqui.
  app.put('/api/storage/mock/*', express.raw({ type: '*/*', limit: '20mb' }), async (req: Request, res: Response) => {
    try {
      const key = (req.params as unknown as { 0: string })[0];
      const destino = caminhoLocalSeguro(key);
      await fs.mkdir(path.dirname(destino), { recursive: true });
      await fs.writeFile(destino, req.body);
      res.status(200).json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gravar arquivo (mock storage)';
      res.status(400).json({ error: msg });
    }
  });

  app.get('/api/storage/mock/*', async (req: Request, res: Response) => {
    try {
      const key = (req.params as unknown as { 0: string })[0];
      const origem = caminhoLocalSeguro(key);
      const conteudo = await fs.readFile(origem);
      res.send(conteudo);
    } catch {
      res.status(404).json({ error: 'Arquivo não encontrado (mock storage).' });
    }
  });

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

  // 2.0.1 Criar uma nova Ação Coletiva — admin. O protocolo (AAAA-MM-DD) é
  // sempre gerado no servidor a partir da data de criação, nunca aceito do
  // cliente (I1).
  app.post('/api/lotes', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM cria Ações Coletivas.' });
        return;
      }
      const { nome, codigo, numeroProcesso, abreEm, closesAt, precoPorNome, bureaus } = req.body;
      if (!nome || typeof nome !== 'string' || !nome.trim()) {
        res.status(400).json({ error: 'Nome da Ação Coletiva é obrigatório.' });
        return;
      }
      if (!abreEm || !closesAt) {
        res.status(400).json({ error: 'Informe a data de início e de encerramento.' });
        return;
      }
      if (!Number.isInteger(precoPorNome) || precoPorNome <= 0) {
        res.status(400).json({ error: 'Preço por nome inválido.' });
        return;
      }
      if (!Array.isArray(bureaus) || bureaus.length === 0) {
        res.status(400).json({ error: 'Selecione ao menos um órgão de proteção ao crédito.' });
        return;
      }
      const lote = await serverStore.createLote(session.id, {
        nome: nome.trim(),
        codigo: typeof codigo === 'string' ? codigo.trim() : null,
        numeroProcesso: typeof numeroProcesso === 'string' ? numeroProcesso.trim() : null,
        abreEm,
        closesAt,
        precoPorNome,
        bureaus,
      });
      res.status(201).json(lote);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar Ação Coletiva';
      res.status(400).json({ error: msg });
    }
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

  // 2.2 Encerrar Ação Coletiva: bloqueia novos envios, gera o pacote
  // (planilha + documentos anexados, em um único ZIP) e avisa a equipe
  // ABDCM no WhatsApp — admin confirma manualmente, não dispara sozinho.
  app.post('/api/lotes/:id/encerrar', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM encerra Ações Coletivas.' });
        return;
      }
      const { id } = req.params;
      const resultado = await serverStore.encerrarLote(id, session.id);
      res.json(resultado);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao encerrar Ação Coletiva';
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

  // 4.6 Pagar / Simular Confirmação PIX da Submissão — com Asaas real
  // configurado, o parceiro NÃO pode se auto-confirmar (I1: regra no
  // servidor, não só esconder o botão); só o webhook do banco ou um
  // admin/suporte fazem essa confirmação manual.
  app.post('/api/submissoes/:id/pagar', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const session = serverStore.getSession();
      if (pixProviderConfigurado() && session.role === 'parceiro') {
        res.status(403).json({ error: 'Com PIX real configurado, a confirmação vem do banco — aguarde ou fale com o suporte.' });
        return;
      }
      const result = await serverStore.paySubmissao(id, session.id);
      dispararAvisosDeStatus(result.registros, 'pago');
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
      dispararAvisosDeStatus(result.registros, 'pago');
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
      const atorTipo = session.role === 'parceiro' ? 'parceiro' : 'admin';
      await serverStore.cancelSubmissao(id, session.id, atorTipo);
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

      dispararAvisosDeStatus([result.registro], paraStatus);

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

  // 6.0.1 Revelação de CPF/CNPJ do associado (aba Associados do admin) — I6
  app.post('/api/associados/:id/reveal-cpf', async (req: Request, res: Response) => {
    const { id } = req.params;
    const session = serverStore.getSession();
    if (session.role === 'parceiro') {
      res.status(403).json({ error: 'Apenas a equipe ABDCM revela CPF/CNPJ de associados.' });
      return;
    }
    try {
      const raw = await serverStore.revealAssociadoCpf(id, session.id);
      res.json({ cpf_cnpj_raw: raw });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao revelar documento';
      res.status(400).json({ error: msg });
    }
  });

  // 6.0.2 Bloquear/reativar acesso do associado — exige reason_code (I11)
  app.patch('/api/associados/:id/status', async (req: Request, res: Response) => {
    const { id } = req.params;
    const session = serverStore.getSession();
    if (session.role === 'parceiro') {
      res.status(403).json({ error: 'Apenas a equipe ABDCM altera o acesso de associados.' });
      return;
    }
    try {
      const { status, reasonCode, observacao } = req.body;
      if (status !== 'ativo' && status !== 'inativo') {
        res.status(400).json({ error: 'Status inválido.' });
        return;
      }
      const associado = await serverStore.updateAssociadoStatus(id, status, reasonCode, session.id, observacao);
      res.json(associado);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar status do associado';
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

  // 6.4 PIX da submissão (retomar/ver o QR já gerado)
  app.get('/api/submissoes/:id/pix', async (req: Request, res: Response) => {
    const cobranca = await serverStore.getPixCobrancaPorSubmissao(req.params.id);
    res.json(cobranca);
  });

  // 6.5 Webhook do provedor de PIX (Asaas) — I2/idempotente: webhook duplicado
  // ou fora de ordem não regride nem repete a confirmação (ver paySubmissao).
  app.post('/api/webhooks/pix', async (req: Request, res: Response) => {
    try {
      const result = await serverStore.confirmarPagamentoPixWebhook(req.body, req.headers as Record<string, string | string[] | undefined>);
      if (result) dispararAvisosDeStatus(result.registros, 'pago');
      res.json({ success: true, processado: Boolean(result) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar webhook de PIX';
      res.status(400).json({ error: msg });
    }
  });

  // 6.6 Status das integrações (Configurações > APIs) — nunca expõe a chave, só se está configurada.
  app.get('/api/config/status', (_req: Request, res: Response) => {
    res.json({
      pix: { provider: 'asaas', configurado: pixProviderConfigurado() },
      whatsapp: { provider: 'z-api', configurado: whatsAppProviderConfigurado() },
      storage: { provider: 'r2', configurado: storageProviderConfigurado() },
    });
  });

  // 6.7 Automações de WhatsApp — configuração das regras + log de envios
  app.get('/api/automacoes', async (_req: Request, res: Response) => {
    res.json(await serverStore.getAutomacoesConfig());
  });

  app.patch('/api/automacoes/:chave', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM configura automações.' });
        return;
      }
      const { ativo, config } = req.body;
      const chave = req.params.chave as Parameters<typeof serverStore.setAutomacaoConfig>[0];
      const atualizado = await serverStore.setAutomacaoConfig(chave, session.id, { ativo, config });
      res.json(atualizado);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar automação';
      res.status(400).json({ error: msg });
    }
  });

  app.get('/api/automacoes/log', async (_req: Request, res: Response) => {
    res.json(await serverStore.getNotificacoesLog());
  });

  app.post('/api/automacoes/rodar-agora', async (_req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM roda automações manualmente.' });
        return;
      }
      const resultado = await rodarAutomacoes();
      res.json(resultado);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao rodar automações';
      res.status(400).json({ error: msg });
    }
  });

  // 6.8 Documentos do associado (CNH/RG) — upload em massa direto pro storage.
  // O servidor nunca recebe o arquivo: só confere o CPF (preview), autoriza
  // o upload (presign) e registra depois que o navegador já mandou (confirmar).
  app.post('/api/documentos/preview', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      const { cpfsCnpjs } = req.body;
      if (!Array.isArray(cpfsCnpjs)) {
        res.status(400).json({ error: 'cpfsCnpjs deve ser uma lista.' });
        return;
      }
      const parceiroId = session.role === 'parceiro' ? session.parceiro_id : undefined;
      const resultado = await serverStore.previewDocumentos(cpfsCnpjs, parceiroId);
      res.json(resultado);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao conferir documentos';
      res.status(400).json({ error: msg });
    }
  });

  app.post('/api/documentos/presign', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      const { associadoId, tipo, mimeType } = req.body;
      const parceiroId = session.role === 'parceiro' ? session.parceiro_id : undefined;
      const resultado = await serverStore.presignDocumentoUpload(associadoId, tipo, mimeType, parceiroId);
      res.json(resultado);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao autorizar upload';
      res.status(400).json({ error: msg });
    }
  });

  app.post('/api/documentos/confirmar', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      const { associadoId, tipo, key, mimeType, nomeArquivo, tamanhoBytes } = req.body;
      const parceiroId = session.role === 'parceiro' ? session.parceiro_id : undefined;
      await serverStore.confirmarDocumentoUpload({
        associadoId,
        tipo,
        key,
        mimeType,
        nomeArquivo,
        tamanhoBytes,
        atorUserId: session.id,
        parceiroId,
      });
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao confirmar upload';
      res.status(400).json({ error: msg });
    }
  });

  app.get('/api/documentos/status', async (_req: Request, res: Response) => {
    const session = serverStore.getSession();
    const parceiroId = session.role === 'parceiro' ? session.parceiro_id : undefined;
    res.json(await serverStore.getDocumentosStatus(parceiroId));
  });

  app.get('/api/associados/:id/documentos/:tipo/download', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      const parceiroId = session.role === 'parceiro' ? session.parceiro_id : undefined;
      const url = await serverStore.getDocumentoDownloadUrl(req.params.id, req.params.tipo as 'cnh' | 'rg', session.id, parceiroId);
      res.json({ url });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar link de download';
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

  // Agendador simples das automações de WhatsApp (proximo_lote, follow_up_lista,
  // pagamento_pendente) — sem fila/cron externo por enquanto, um único
  // processo já dá conta do volume de uma associação. Cada regra é
  // idempotente por conta própria (ver notificacoes.ts), então rodar de
  // novo a cada intervalo é seguro.
  const INTERVALO_AUTOMACOES_MS = 15 * 60 * 1000; // 15 minutos
  setTimeout(() => {
    rodarAutomacoes().catch((err) => console.error('[automacoes] falha na primeira rodada:', err));
    setInterval(() => {
      rodarAutomacoes().catch((err) => console.error('[automacoes] falha na rodada agendada:', err));
    }, INTERVALO_AUTOMACOES_MS);
  }, 30_000);
}

startServer();
