-- Contestações (canal "Reclame Aqui"), catálogo de serviços e contrato-modelo.

create table if not exists contestacoes (
  id            text primary key,
  tenant_id     text not null,
  parceiro_id   text not null,
  lote_id       text not null references lotes (id),
  registro_id   text,
  motivo        text not null,
  observacao    text,
  status        text not null,
  aberta_em     timestamptz not null default now(),
  sla_vence_em  timestamptz not null,
  resolvido_em  timestamptz
);
create index if not exists contestacoes_tenant_idx on contestacoes (tenant_id);
create index if not exists contestacoes_lote_idx on contestacoes (tenant_id, lote_id);

create table if not exists servicos (
  id          text primary key,
  tenant_id   text not null,
  nome        text not null,
  descricao   text,
  preco       integer not null,
  prazo_dias  integer not null,
  usa_listas  boolean not null default false,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists servicos_tenant_idx on servicos (tenant_id);

create table if not exists contratos (
  id                text primary key,
  tenant_id         text not null,
  nome_arquivo      text not null,
  mime_type         text not null,
  conteudo_base64   text not null,
  atualizado_em     timestamptz not null default now()
);
create index if not exists contratos_tenant_idx on contratos (tenant_id);

-- Reenvio de comprovante em submissão reprovada.
alter table submissoes add column if not exists comprovante_base64 text;
alter table submissoes add column if not exists comprovante_mime text;
