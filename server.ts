/**
 * Servidor Express com Vite Middleware — Plataforma ABDCM
 * Conforme diretrizes de Full-Stack e Invariante I1 (nenhuma regra no cliente).
 */

import { config } from 'dotenv';
import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { serverStore } from './src/server/store';
import { authContext } from './src/server/auth/context';
import { SESSION_COOKIE_NAME, verificarTokenSessao } from './src/server/auth/session';
import { cleanDocument } from './src/lib/masking/documentMasker';
import { avisarStatusProcesso, rodarAutomacoes } from './src/server/notificacoes';
import { pixProviderConfigurado } from './src/integrations/pix/index';
import { whatsAppProviderConfigurado } from './src/integrations/whatsapp/index';
import { storageProviderConfigurado, caminhoLocalSeguro } from './src/integrations/storage/index';
import { ocrProviderConfigurado } from './src/integrations/ocr/index';
import { monitoramentoProviderConfigurado } from './src/integrations/monitoramento/index';
import type { Registro, OrgaoBureau } from './src/domain/types';
import { promises as fs } from 'node:fs';
import { onEvento, type EventoTempoReal } from './src/server/eventBus';

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

const SESSION_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias, igual ao TTL do token

function definirCookieSessao(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

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

  // Sessão real (parceiro/administrador) via cookie assinado — disponível
  // pro resto da request via AsyncLocalStorage (src/server/auth/context.ts),
  // sem precisar passar `req` por toda a cadeia do store. Sem cookie válido,
  // authContext fica null e serverStore.getSession() cai no seletor de
  // papel de demonstração, exatamente como antes desta funcionalidade.
  app.use((req: Request, _res: Response, next) => {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE_NAME];
    const verificado = verificarTokenSessao(token);
    if (!verificado) {
      authContext.run(null, next);
      return;
    }
    serverStore
      .buscarUsuarioPorId(verificado.uid)
      .then((sessaoReal) => authContext.run(sessaoReal, next))
      .catch((err) => {
        console.error('[auth] falha ao resolver sessão real:', err);
        authContext.run(null, next);
      });
  });

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

  // 1.1 Login real (parceiro e administrador) — os outros 4 papéis continuam
  // só na troca de papel de demonstração acima.
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, senha } = req.body ?? {};
      if (typeof email !== 'string' || typeof senha !== 'string') {
        res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
        return;
      }
      const resultado = await serverStore.autenticarUsuario(email, senha);
      if ('erro' in resultado) {
        res.status(401).json({ error: resultado.erro });
        return;
      }
      definirCookieSessao(res, resultado.token);
      res.json(resultado.sessao);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao entrar.';
      res.status(400).json({ error: msg });
    }
  });

  // 1.2 Cadastro de parceiro (self-service). Contas de administrador não têm
  // cadastro aberto — são provisionadas por quem já administra o tenant.
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { nome, email, senha } = req.body ?? {};
      if (typeof nome !== 'string' || typeof email !== 'string' || typeof senha !== 'string') {
        res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
        return;
      }
      const resultado = await serverStore.registrarParceiro({ nome, email, senha });
      if ('erro' in resultado) {
        res.status(400).json({ error: resultado.erro });
        return;
      }
      definirCookieSessao(res, resultado.token);
      res.status(201).json(resultado.sessao);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar.';
      res.status(400).json({ error: msg });
    }
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({ success: true });
  });

  // 1.3 Troca de senha — só pra quem está de fato logado com conta real
  // (cookie assinado); modo demonstração não tem senha pra trocar.
  app.post('/api/auth/change-password', async (req: Request, res: Response) => {
    const session = serverStore.getSession();
    if (!session.autenticado) {
      res.status(401).json({ error: 'Faça login com sua conta para trocar a senha.' });
      return;
    }
    const { senhaAtual, novaSenha } = req.body ?? {};
    if (typeof senhaAtual !== 'string' || typeof novaSenha !== 'string') {
      res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias.' });
      return;
    }
    const resultado = await serverStore.alterarSenha(session.id, senhaAtual, novaSenha);
    if ('erro' in resultado) {
      res.status(400).json({ error: resultado.erro });
      return;
    }
    res.json({ success: true });
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
      const {
        closesAt,
        nome,
        numeroProcesso,
        varaTribunal,
        juiz,
        referenciaProtocolo,
        dataProtocolo,
        dataDistribuicao,
        liminarStatus,
      } = req.body;
      const lote = await serverStore.updateLote(id, session.id, {
        closesAt,
        nome,
        numeroProcesso,
        varaTribunal,
        juiz,
        referenciaProtocolo,
        dataProtocolo,
        dataDistribuicao,
        liminarStatus,
      });
      res.json(lote);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar lote';
      res.status(400).json({ error: msg });
    }
  });

  // 2.1.1 Downloads em massa (planilha e documentos), sob demanda — não
  // muda status do lote, diferente de /encerrar. Navegação direta (<a
  // href>), então usa o cookie de sessão normal, sem precisar de fetch+blob.
  app.get('/api/lotes/:id/planilha.xlsx', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM baixa a lista completa.' });
        return;
      }
      const { buffer, nomeArquivo } = await serverStore.gerarPlanilhaLoteBuffer(req.params.id);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
      res.send(Buffer.from(buffer));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar planilha';
      res.status(400).json({ error: msg });
    }
  });

  app.get('/api/lotes/:id/documentos.zip', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM baixa os documentos em massa.' });
        return;
      }
      const { buffer, nomeArquivo } = await serverStore.gerarZipDocumentosLote(req.params.id);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
      res.send(buffer);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar arquivo de documentos';
      res.status(400).json({ error: msg });
    }
  });

  app.get('/api/lotes/:id/fichas-associativas.zip', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM baixa as fichas associativas em massa.' });
        return;
      }
      const { buffer, nomeArquivo } = await serverStore.gerarZipDocumentosLote(req.params.id, 'ficha_associativa');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
      res.send(buffer);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar arquivo de fichas associativas';
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

  // 3.5 Eventos em tempo real (Server-Sent Events) — avisa o navegador que
  // algo mudou (pagamento, lote, documento...) pra ele refazer o fetch na
  // hora, em vez de esperar o próximo poll. Nunca carrega o dado em si no
  // evento — quem decide o que a sessão pode ver continua sendo a rota GET
  // de sempre (I1); isso aqui só avisa "vai buscar de novo".
  app.get('/api/eventos/stream', (req: Request, res: Response) => {
    const session = serverStore.getSession();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 4000\n\n');

    const enviar = (evento: EventoTempoReal) => {
      // Parceiro só recebe evento do próprio parceiro_id ou sem dono
      // (relevante pra todo mundo, ex.: lote mudou de status).
      if (session.role === 'parceiro' && evento.parceiroId && evento.parceiroId !== session.parceiro_id) return;
      res.write(`data: ${JSON.stringify(evento)}\n\n`);
    };
    const cancelar = onEvento(enviar);

    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(heartbeat);
      cancelar();
    });
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

  // 4.2 Importação em Massa de Registros (Planilha Excel/CSV), com anexo
  // opcional de documentos (CNH/RG/ficha associativa) já casados por CPF.
  app.post('/api/registros/import', async (req: Request, res: Response) => {
    try {
      const { itens } = req.body;
      if (!Array.isArray(itens) || itens.length === 0) {
        res.status(400).json({ error: 'Nenhum item válido para importação.' });
        return;
      }
      const session = serverStore.getSession();
      const importados = await serverStore.importarRegistros(itens, session.id);
      res.status(201).json({ success: true, count: importados.length, importados });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro na importação';
      res.status(400).json({ error: msg });
    }
  });

  // 4.2.1 Preview da planilha (lê o arquivo já enviado pro storage, nada
  // é gravado no banco — I3).
  app.post('/api/registros/import/preview', async (req: Request, res: Response) => {
    try {
      const { key, mimeType, nomeArquivo } = req.body;
      const resultado = await serverStore.parseArquivoImportacao(key, mimeType, nomeArquivo);
      res.json(resultado);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao ler a planilha';
      res.status(400).json({ error: msg });
    }
  });

  // 4.2.2 Leitura automática (OCR) dos documentos anexados junto com a
  // importação — casa cada arquivo com uma linha da planilha por CPF.
  app.post('/api/registros/import/ocr-preview', async (req: Request, res: Response) => {
    try {
      const { itens, linhas } = req.body;
      if (!Array.isArray(itens) || !Array.isArray(linhas)) {
        res.status(400).json({ error: 'itens e linhas devem ser listas.' });
        return;
      }
      const resultado = await serverStore.lerDocumentosOcrParaImportacao(itens, linhas);
      res.json(resultado);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao ler os documentos';
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

  // 4.6.4 Ver Comprovante — o parceiro só vê o próprio; a equipe ABDCM vê qualquer um.
  app.get('/api/submissoes/:id/comprovante', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const session = serverStore.getSession();
      const comprovante = await serverStore.getComprovante(id);
      if (!comprovante) {
        res.status(404).json({ error: 'Nenhum comprovante anexado nesta submissão.' });
        return;
      }
      if (session.role === 'parceiro' && session.parceiro_id !== comprovante.parceiroId) {
        res.status(403).json({ error: 'Você só pode ver comprovantes das suas próprias submissões.' });
        return;
      }
      res.json({ comprovanteBase64: comprovante.comprovanteBase64, mimeType: comprovante.mimeType });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar comprovante';
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
      const { nome, descricao, preco, custo, prazoDias, usaListas, fotoUrl, linkRedirecionamento } = req.body;
      const novo = await serverStore.createServico({
        nome,
        descricao,
        preco,
        custo,
        prazoDias,
        usaListas,
        fotoUrl,
        linkRedirecionamento,
      });
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

  // 6.1.1 Marketing de serviços — aba Serviços > Marketing (admin-only)
  app.get('/api/marketing/log', async (_req: Request, res: Response) => {
    const session = serverStore.getSession();
    if (session.role === 'parceiro') {
      res.status(403).json({ error: 'Apenas a equipe ABDCM acessa o marketing de serviços.' });
      return;
    }
    res.json(await serverStore.getMarketingLog());
  });

  app.get('/api/marketing/cronograma', async (_req: Request, res: Response) => {
    const session = serverStore.getSession();
    if (session.role === 'parceiro') {
      res.status(403).json({ error: 'Apenas a equipe ABDCM acessa o marketing de serviços.' });
      return;
    }
    res.json(await serverStore.getMarketingCronograma());
  });

  app.put('/api/marketing/cronograma/:diaSemana', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM configura o marketing de serviços.' });
        return;
      }
      const diaSemana = parseInt(req.params.diaSemana, 10);
      const { servicoId, ativo } = req.body;
      const linha = await serverStore.setMarketingCronogramaDia(diaSemana, servicoId ?? null, ativo ?? true);
      res.json(linha);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao configurar cronograma';
      res.status(400).json({ error: msg });
    }
  });

  app.post('/api/marketing/disparo', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM dispara marketing.' });
        return;
      }
      const { servicoId, mensagem } = req.body;
      const resultado = await serverStore.dispararMarketingServico(servicoId, mensagem, 'manual', session.id);
      res.json(resultado);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao disparar marketing';
      res.status(400).json({ error: msg });
    }
  });

  app.get('/api/marketing/grupo-config', async (_req: Request, res: Response) => {
    const session = serverStore.getSession();
    if (session.role === 'parceiro') {
      res.status(403).json({ error: 'Apenas a equipe ABDCM acessa o marketing de serviços.' });
      return;
    }
    res.json(await serverStore.getMarketingGrupoConfig());
  });

  app.put('/api/marketing/grupo-config', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM configura o marketing de serviços.' });
        return;
      }
      const atualizado = await serverStore.setMarketingGrupoConfig(req.body);
      res.json(atualizado);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar configuração';
      res.status(400).json({ error: msg });
    }
  });

  // 6.2.1 Eventos e Notícias — CMS controlado pelo admin (live, novo
  // serviço, comunicados etc), exibido pro parceiro na aba Eventos.
  app.get('/api/eventos-noticias', async (_req: Request, res: Response) => {
    res.json(await serverStore.getEventosNoticias());
  });

  app.post('/api/eventos-noticias', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM publica eventos e notícias.' });
        return;
      }
      const { tipo, titulo, descricao, categoria, imagemUrl, linkExterno, dataEvento } = req.body;
      const novo = await serverStore.createEventoNoticia({
        tipo,
        titulo,
        descricao,
        categoria,
        imagemUrl,
        linkExterno,
        dataEvento,
        atorUserId: session.id,
      });
      res.status(201).json(novo);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao publicar';
      res.status(400).json({ error: msg });
    }
  });

  app.patch('/api/eventos-noticias/:id', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM edita eventos e notícias.' });
        return;
      }
      const atualizado = await serverStore.updateEventoNoticia(req.params.id, req.body);
      res.json(atualizado);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar';
      res.status(400).json({ error: msg });
    }
  });

  app.delete('/api/eventos-noticias/:id', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM remove eventos e notícias.' });
        return;
      }
      await serverStore.deleteEventoNoticia(req.params.id);
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao remover';
      res.status(400).json({ error: msg });
    }
  });

  // 6.3 Contratos e Documentos Complementares (admin anexa quantos quiser —
  // ficha associativa modelo, contrato de intermediação etc; parceiro só lê)
  app.get('/api/contratos', async (_req: Request, res: Response) => {
    const contratos = await serverStore.getContratos();
    res.json(contratos);
  });

  app.post('/api/contratos', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM anexa documentos.' });
        return;
      }
      const { titulo, nomeArquivo, mimeType, conteudoBase64 } = req.body;
      const contrato = await serverStore.addContrato({ titulo, nomeArquivo, mimeType, conteudoBase64 });
      res.status(201).json(contrato);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao anexar documento';
      res.status(400).json({ error: msg });
    }
  });

  app.delete('/api/contratos/:id', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM remove documentos.' });
        return;
      }
      await serverStore.deleteContrato(req.params.id);
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao remover documento';
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

  // 6.5.1 Webhook do provedor de monitoramento processual (JUDIT) — avisa
  // quando o processo de algum lote monitorado tem movimentação nova.
  app.post('/api/webhooks/monitoramento-processo', async (req: Request, res: Response) => {
    try {
      const result = await serverStore.processarWebhookMonitoramentoProcesso(
        req.body,
        req.headers as Record<string, string | string[] | undefined>,
      );
      res.json({ success: true, processado: Boolean(result), novas_movimentacoes: result?.novasMovimentacoes ?? 0 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar webhook de monitoramento';
      res.status(400).json({ error: msg });
    }
  });

  // 6.5.2 Movimentações do processo de um lote — timeline, admin only.
  app.get('/api/lotes/:id/movimentacoes', async (req: Request, res: Response) => {
    const session = serverStore.getSession();
    if (session.role === 'parceiro') {
      res.status(403).json({ error: 'Apenas a equipe ABDCM acompanha movimentações do processo.' });
      return;
    }
    res.json(await serverStore.getMovimentacoesProcesso(req.params.id));
  });

  // 6.6 Status das integrações (Configurações > APIs) — nunca expõe a chave, só se está configurada.
  // 6.4.1 Controle de Acesso — lista de contas reais e ativar/desativar
  app.get('/api/admin/usuarios', async (_req: Request, res: Response) => {
    const session = serverStore.getSession();
    if (session.role === 'parceiro') {
      res.status(403).json({ error: 'Apenas a equipe ABDCM vê as contas de acesso.' });
      return;
    }
    res.json(await serverStore.listarUsuarios());
  });

  app.patch('/api/admin/usuarios/:id/ativo', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role !== 'administrador') {
        res.status(403).json({ error: 'Apenas o administrador ativa ou desativa contas de acesso.' });
        return;
      }
      const { ativo } = req.body;
      await serverStore.setUsuarioAtivo(req.params.id, Boolean(ativo), session.id);
      res.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar conta';
      res.status(400).json({ error: msg });
    }
  });

  // 6.5.1 Métricas extras do Dashboard (parceiros novos, rankings) — admin only
  app.get('/api/admin/dashboard-extra', async (_req: Request, res: Response) => {
    const session = serverStore.getSession();
    if (session.role === 'parceiro') {
      res.status(403).json({ error: 'Apenas a equipe ABDCM vê essas métricas.' });
      return;
    }
    res.json(await serverStore.getDashboardExtra());
  });

  app.get('/api/config/status', (_req: Request, res: Response) => {
    res.json({
      pix: { provider: 'asaas', configurado: pixProviderConfigurado() },
      whatsapp: { provider: 'z-api', configurado: whatsAppProviderConfigurado() },
      storage: { provider: 'r2', configurado: storageProviderConfigurado() },
      ocr: { provider: 'claude', configurado: ocrProviderConfigurado() },
      monitoramento: { provider: 'judit', configurado: monitoramentoProviderConfigurado() },
    });
  });

  // 6.6.1 Dados cadastrais da empresa (Configurações > Empresa)
  app.get('/api/config/empresa', async (_req: Request, res: Response) => {
    res.json(await serverStore.getConfiguracaoEmpresa());
  });

  app.put('/api/config/empresa', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM edita os dados da empresa.' });
        return;
      }
      const {
        razaoSocial,
        cnpj,
        endereco,
        telefone,
        email,
        bancoNome,
        bancoAgencia,
        bancoConta,
        bancoPixChave,
        oabNumero,
        oabUf,
      } = req.body;
      const atualizado = await serverStore.setConfiguracaoEmpresa({
        razao_social: razaoSocial || '',
        cnpj: cnpj || '',
        endereco: endereco || '',
        telefone: telefone || '',
        email: email || '',
        banco_nome: bancoNome || '',
        banco_agencia: bancoAgencia || '',
        banco_conta: bancoConta || '',
        banco_pix_chave: bancoPixChave || '',
        oab_numero: oabNumero || '',
        oab_uf: oabUf || '',
      });
      res.json(atualizado);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar dados da empresa';
      res.status(400).json({ error: msg });
    }
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

  // 6.7.1 Mensagens extras por gatilho — botão "Criar Nova Mensagem"
  const exigirEquipeAbdcm = (session: ReturnType<typeof serverStore.getSession>, res: Response): boolean => {
    if (session.role === 'parceiro') {
      res.status(403).json({ error: 'Apenas a equipe ABDCM acessa automações.' });
      return false;
    }
    return true;
  };

  app.get('/api/automacoes/mensagens-extra', async (_req: Request, res: Response) => {
    res.json(await serverStore.getMensagensExtra());
  });

  app.post('/api/automacoes/mensagens-extra', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (!exigirEquipeAbdcm(session, res)) return;
      const novo = await serverStore.createMensagemExtra(req.body);
      res.status(201).json(novo);
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao criar mensagem' });
    }
  });

  app.patch('/api/automacoes/mensagens-extra/:id', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (!exigirEquipeAbdcm(session, res)) return;
      const atualizado = await serverStore.updateMensagemExtra(req.params.id, req.body);
      res.json(atualizado);
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar mensagem' });
    }
  });

  app.delete('/api/automacoes/mensagens-extra/:id', async (req: Request, res: Response) => {
    const session = serverStore.getSession();
    if (!exigirEquipeAbdcm(session, res)) return;
    await serverStore.deleteMensagemExtra(req.params.id);
    res.json({ success: true });
  });

  // 6.7.2 Automação de ligação — MOCK (CLAUDE.md seção 8)
  app.get('/api/automacoes/chamadas', async (_req: Request, res: Response) => {
    res.json(await serverStore.getChamadasConfig());
  });

  app.post('/api/automacoes/chamadas', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (!exigirEquipeAbdcm(session, res)) return;
      const novo = await serverStore.createChamadaConfig(req.body);
      res.status(201).json(novo);
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao criar configuração de ligação' });
    }
  });

  app.patch('/api/automacoes/chamadas/:id', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (!exigirEquipeAbdcm(session, res)) return;
      const atualizado = await serverStore.updateChamadaConfig(req.params.id, req.body);
      res.json(atualizado);
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar configuração de ligação' });
    }
  });

  app.delete('/api/automacoes/chamadas/:id', async (req: Request, res: Response) => {
    const session = serverStore.getSession();
    if (!exigirEquipeAbdcm(session, res)) return;
    await serverStore.deleteChamadaConfig(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/automacoes/chamadas/:id/testar', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (!exigirEquipeAbdcm(session, res)) return;
      const resultado = await serverStore.testarChamada(req.params.id, req.body.telefone);
      res.json(resultado);
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao testar ligação' });
    }
  });

  app.get('/api/automacoes/chamadas/log', async (_req: Request, res: Response) => {
    res.json(await serverStore.getChamadasLog());
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

  // 6.8.1 Anexo com leitura automática (OCR): presign sem associado nem tipo
  // ainda conhecidos, e leitura+casamento por CPF depois que o navegador já
  // mandou os arquivos pro storage.
  app.post('/api/documentos/staging/presign', async (req: Request, res: Response) => {
    try {
      const { mimeType } = req.body;
      const resultado = await serverStore.presignStagingUpload(mimeType);
      res.json(resultado);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao autorizar upload';
      res.status(400).json({ error: msg });
    }
  });

  app.post('/api/documentos/ocr/preview', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      const { itens } = req.body;
      if (!Array.isArray(itens)) {
        res.status(400).json({ error: 'itens deve ser uma lista.' });
        return;
      }
      const parceiroId = session.role === 'parceiro' ? session.parceiro_id : undefined;
      const resultado = await serverStore.lerDocumentosOcr(itens, parceiroId);
      res.json(resultado);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao ler documentos';
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

  // Status por órgão (birô) de cada registro protocolado — popup "Ver
  // nomes anexados" em Minhas Listas.
  app.get('/api/registro-orgaos', async (_req: Request, res: Response) => {
    const session = serverStore.getSession();
    const parceiroId = session.role === 'parceiro' ? session.parceiro_id : undefined;
    res.json(await serverStore.getStatusOrgaosPorParceiro(parceiroId));
  });

  // Nada consta emitido automaticamente quando todos os órgãos dão baixa.
  app.get('/api/nada-consta', async (_req: Request, res: Response) => {
    const session = serverStore.getSession();
    const parceiroId = session.role === 'parceiro' ? session.parceiro_id : undefined;
    res.json(await serverStore.getNadaConstaPorParceiro(parceiroId));
  });

  // Admin registra a baixa de um órgão específico pra um registro
  // protocolado. Quando o 5º órgão baixa, o registro vira "baixado"
  // automaticamente e o nada consta é emitido sozinho.
  app.post('/api/registros/:id/orgaos/:orgao/baixar', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      if (session.role === 'parceiro') {
        res.status(403).json({ error: 'Apenas a equipe ABDCM registra baixa de órgão.' });
        return;
      }
      const { id, orgao } = req.params;
      const resultado = await serverStore.marcarOrgaoBaixado(id, orgao as OrgaoBureau, session.id);
      res.json(resultado);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao registrar baixa';
      res.status(400).json({ error: msg });
    }
  });

  app.get('/api/associados/:id/documentos/:tipo/download', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      const parceiroId = session.role === 'parceiro' ? session.parceiro_id : undefined;
      const url = await serverStore.getDocumentoDownloadUrl(
        req.params.id,
        req.params.tipo as 'cnh' | 'rg' | 'comprovante_inscricao' | 'ficha_associativa',
        session.id,
        parceiroId,
      );
      res.json({ url });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar link de download';
      res.status(400).json({ error: msg });
    }
  });

  // Gera automaticamente a ficha associativa (Termo de Autorização e
  // Representação) de um associado a partir de um documento de identidade
  // já enviado ao storage (mesmo key de /api/documentos/staging/presign) —
  // OCR extrai onde está a assinatura na foto, o servidor monta o PDF e
  // grava consentimento (data/IP/hash) no associado (I5).
  app.post('/api/associados/:id/gerar-ficha-automatica', async (req: Request, res: Response) => {
    try {
      const session = serverStore.getSession();
      const { key, mimeType } = req.body;
      const parceiroId = session.role === 'parceiro' ? session.parceiro_id : undefined;
      const resultado = await serverStore.gerarFichaAssociativaAutomatica(
        req.params.id,
        key,
        mimeType,
        session.id,
        req.ip ?? '127.0.0.1',
        parceiroId,
      );
      res.json(resultado);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar ficha associativa';
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
  const rodarTudo = () => {
    rodarAutomacoes().catch((err) => console.error('[automacoes] falha na rodada:', err));
    // Cronograma semanal de marketing (aba Serviços > Marketing) — mesmo
    // agendador, idempotente por dia (ver rodarMarketingCronogramaDoDia).
    serverStore.rodarMarketingCronogramaDoDia().catch((err) => console.error('[marketing] falha no cronograma:', err));
    // Follow-up de ligação (mock) — mesmo agendador, idempotente por config+telefone.
    serverStore.rodarFollowUpLigacoes().catch((err) => console.error('[automacoes] falha no follow-up de ligação:', err));
  };
  setTimeout(() => {
    rodarTudo();
    setInterval(rodarTudo, INTERVALO_AUTOMACOES_MS);
  }, 30_000);

  // Reconciliação ativa de PIX — intervalo bem mais curto que o das
  // automações de WhatsApp porque é isso que faz o QR Code virar "pago" na
  // tela do parceiro sem depender só do webhook chegar. Backup do webhook,
  // não substituto (ver reconciliarPixPendentes em store.ts).
  const INTERVALO_RECONCILIACAO_PIX_MS = 30 * 1000; // 30 segundos
  setInterval(() => {
    serverStore.reconciliarPixPendentes().catch((err) => console.error('[reconciliacao-pix] falha na rodada:', err));
  }, INTERVALO_RECONCILIACAO_PIX_MS);

  // Reconciliação do monitoramento processual — bem mais espaçada que a de
  // PIX: andamento de processo judicial não muda a cada segundo, e é só
  // reforço pro webhook (ver reconciliarMonitoramentoPendente em store.ts).
  const INTERVALO_RECONCILIACAO_MONITORAMENTO_MS = 30 * 60 * 1000; // 30 minutos
  setInterval(() => {
    serverStore
      .reconciliarMonitoramentoPendente()
      .catch((err) => console.error('[reconciliacao-monitoramento] falha na rodada:', err));
  }, INTERVALO_RECONCILIACAO_MONITORAMENTO_MS);
}

startServer();
