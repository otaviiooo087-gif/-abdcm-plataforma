-- Credenciais de integração guardadas criptografadas no banco (I10 revisado
-- — ver CLAUDE.md), e registro de custo por chamada de API paga.

CREATE TABLE IF NOT EXISTS credenciais_integracao (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  dados_criptografados TEXT NOT NULL,
  chaves TEXT[] NOT NULL,
  custo_unitario_centavos INTEGER,
  unidade_custo TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL,
  atualizado_por TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  UNIQUE (tenant_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_credenciais_integracao_tenant ON credenciais_integracao (tenant_id, provider);

CREATE TABLE IF NOT EXISTS api_uso (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  operacao TEXT NOT NULL,
  custo_centavos INTEGER NOT NULL DEFAULT 0,
  referencia_id TEXT,
  criado_em TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_uso_tenant_provider ON api_uso (tenant_id, provider, criado_em DESC);
