-- Eventos e Notícias — CMS simples controlado pelo admin (live, novo
-- serviço, comunicados etc), exibido de forma imersiva no portal do
-- parceiro.
CREATE TABLE IF NOT EXISTS eventos_noticias (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL,
  imagem_url TEXT,
  link_externo TEXT,
  data_evento TIMESTAMPTZ,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS eventos_noticias_tenant_idx ON eventos_noticias (tenant_id);
