-- Mensagens extras por gatilho — aba Automações > "Criar Nova Mensagem".
-- Cada gatilho (proximo_lote, follow_up_lista, pagamento_pendente,
-- cadastro_associado, ...) já dispara sua mensagem padrão; isto permite ao
-- admin acrescentar mensagens adicionais no mesmo gatilho sem mexer na
-- padrão. "Editar Mensagem" da padrão continua guardado em
-- automacoes_config.config.mensagemTemplate (sem migration — já é jsonb).
CREATE TABLE IF NOT EXISTS mensagens_extra (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  gatilho TEXT NOT NULL,
  nome TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL
);

-- Automação de ligação (MOCK — nenhum provedor de telefonia/IVR está
-- contratado, mesma doutrina de mock das outras integrações, CLAUDE.md
-- seção 8). Um roteiro por serviço (servico_id null = Ação Limpa Nome /
-- lotes em geral), com ramificação sim/não e follow-up configurável antes
-- do prazo.
CREATE TABLE IF NOT EXISTS chamadas_config (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  servico_id TEXT,
  nome TEXT NOT NULL,
  roteiro_abertura TEXT NOT NULL,
  roteiro_resposta_sim TEXT NOT NULL,
  roteiro_resposta_nao TEXT NOT NULL,
  dias_antes_prazo INTEGER,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS chamadas_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  config_id TEXT NOT NULL,
  servico_id TEXT,
  associado_id TEXT,
  telefone TEXT NOT NULL,
  resultado TEXT NOT NULL, -- 'sim' | 'nao' | 'sem_resposta'
  transcricao TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'automatico'
  criado_em TIMESTAMPTZ NOT NULL
);
