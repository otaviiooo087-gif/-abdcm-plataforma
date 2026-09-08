-- Custo interno do serviço (nunca exibido ao parceiro/associado — só ao
-- admin, pra comparar com o preço final e ver a margem).
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS custo INTEGER NOT NULL DEFAULT 0;

-- Cronograma semanal de marketing — aba Serviços > Marketing. Uma linha por
-- dia da semana (0=domingo..6=sábado); o serviço em destaque naquele dia é
-- disparado automaticamente pelo agendador já existente (rodarAutomacoes).
CREATE TABLE IF NOT EXISTS marketing_cronograma (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  dia_semana INTEGER NOT NULL,
  servico_id TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  atualizado_em TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_cronograma_tenant_dia_idx
  ON marketing_cronograma (tenant_id, dia_semana);

-- Log de disparos de marketing (manual pelo admin ou automático pelo
-- cronograma semanal) — histórico de quem recebeu o quê e quando.
CREATE TABLE IF NOT EXISTS marketing_disparos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  servico_id TEXT NOT NULL,
  origem TEXT NOT NULL, -- 'manual' | 'automatico'
  mensagem TEXT NOT NULL,
  quantidade_destinatarios INTEGER NOT NULL,
  disparado_por_user_id TEXT,
  disparado_em TIMESTAMPTZ NOT NULL
);

-- Config do robô de grupos de WhatsApp — MOCK: guarda a configuração que o
-- admin monta (aviso de lista, marketing, enquetes), mas nenhum provedor
-- real de grupo/enquete está contratado ainda (mesma doutrina de mock das
-- outras integrações, CLAUDE.md seção 8). Uma linha por tenant.
CREATE TABLE IF NOT EXISTS marketing_grupo_config (
  tenant_id TEXT PRIMARY KEY,
  nome_grupo TEXT NOT NULL DEFAULT '',
  aviso_lista_ativo BOOLEAN NOT NULL DEFAULT false,
  marketing_ativo BOOLEAN NOT NULL DEFAULT false,
  enquetes_ativo BOOLEAN NOT NULL DEFAULT false,
  atualizado_em TIMESTAMPTZ NOT NULL
);
