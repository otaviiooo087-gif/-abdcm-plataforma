-- Dados cadastrais da ABDCM (empresa, conta bancária, OAB) — uma linha só
-- por tenant, editável na aba Configurações > Empresa.
CREATE TABLE IF NOT EXISTS configuracao_empresa (
  tenant_id TEXT PRIMARY KEY,
  razao_social TEXT NOT NULL DEFAULT '',
  cnpj TEXT NOT NULL DEFAULT '',
  endereco TEXT NOT NULL DEFAULT '',
  telefone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  banco_nome TEXT NOT NULL DEFAULT '',
  banco_agencia TEXT NOT NULL DEFAULT '',
  banco_conta TEXT NOT NULL DEFAULT '',
  banco_pix_chave TEXT NOT NULL DEFAULT '',
  oab_numero TEXT NOT NULL DEFAULT '',
  oab_uf TEXT NOT NULL DEFAULT '',
  atualizado_em TIMESTAMPTZ NOT NULL
);
