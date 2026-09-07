-- CNH/RG anexados por associado (upload em massa, direto pro storage —
-- ver src/integrations/storage). Um documento por (associado, tipo): um
-- upload novo do mesmo tipo substitui o anterior.

create table if not exists documentos_associado (
  id               text primary key,
  tenant_id        text not null,
  associado_id     text not null references associados (id),
  tipo             text not null,
  storage_key      text not null,
  storage_provider text not null,
  mime_type        text not null,
  nome_arquivo     text not null,
  tamanho_bytes    integer,
  enviado_por_user_id text,
  enviado_em       timestamptz not null default now()
);
create index if not exists documentos_associado_tenant_idx on documentos_associado (tenant_id);
create index if not exists documentos_associado_associado_idx on documentos_associado (associado_id);
create unique index if not exists documentos_associado_associado_tipo_idx on documentos_associado (associado_id, tipo);
