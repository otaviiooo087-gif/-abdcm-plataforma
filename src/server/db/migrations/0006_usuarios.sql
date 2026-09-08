-- Contas reais (login com senha) para os papéis parceiro e administrador.
-- Os outros 4 papéis (conciliador, operador, suporte, financeiro) continuam
-- na troca de papel de demonstração (/api/auth/switch-role) por enquanto.
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  senha_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  parceiro_id TEXT,
  partner_code TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_tenant_email_idx ON usuarios (tenant_id, lower(email));
CREATE INDEX IF NOT EXISTS usuarios_tenant_idx ON usuarios (tenant_id);
