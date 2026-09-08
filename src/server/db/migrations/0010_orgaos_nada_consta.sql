-- Status por órgão (birô de crédito) de cada registro protocolado — camada
-- suplementar de detalhe, não um 9º ProcessStatus. Quando todos os órgãos
-- de um registro ficam "baixado", o registro transiciona pra "baixado" (já
-- previsto na máquina de estados) e o nada consta é emitido automaticamente.
CREATE TABLE IF NOT EXISTS registro_orgaos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  registro_id TEXT NOT NULL,
  orgao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  baixado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS registro_orgaos_registro_orgao_idx ON registro_orgaos (registro_id, orgao);
CREATE INDEX IF NOT EXISTS registro_orgaos_tenant_idx ON registro_orgaos (tenant_id);

CREATE TABLE IF NOT EXISTS nada_consta_emissoes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  registro_id TEXT NOT NULL,
  associado_id TEXT NOT NULL,
  protocolo_consulta TEXT NOT NULL,
  documento_base64 TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  emitido_em TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS nada_consta_registro_idx ON nada_consta_emissoes (registro_id);
CREATE INDEX IF NOT EXISTS nada_consta_tenant_idx ON nada_consta_emissoes (tenant_id);
