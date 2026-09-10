-- Monitoramento processual automático (via API real, ver
-- src/integrations/monitoramento) — quando um lote ganha numero_processo,
-- o sistema abre um acompanhamento junto ao provedor e passa a registrar
-- aqui as movimentações que chegam por webhook (ou pela reconciliação
-- periódica de reforço).
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS judit_tracking_id TEXT;

CREATE TABLE IF NOT EXISTS processo_movimentacoes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  lote_id TEXT NOT NULL,
  descricao TEXT NOT NULL,
  ocorrido_em TIMESTAMPTZ,
  fonte TEXT,
  origem TEXT NOT NULL DEFAULT 'webhook', -- 'webhook' | 'reconciliacao'
  criado_em TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_processo_movimentacoes_lote ON processo_movimentacoes (lote_id, criado_em DESC);
