-- Cards de Serviços mais ricos: foto de capa (anexada pelo admin) e um
-- link de redirecionamento (igual ao botão "Fale com a gente" da Home).
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS link_redirecionamento TEXT;
