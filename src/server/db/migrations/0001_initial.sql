-- Schema inicial da Plataforma ABDCM (persistência real via Postgres).
-- Espelha os tipos de src/domain/types.ts. tenant_id em toda tabela (I9).

create table if not exists lotes (
  id                    text primary key,
  tenant_id             text not null,
  nome                  text not null,
  codigo                text,
  numero_sequencial     integer not null,
  status                text not null,
  abre_em               timestamptz not null,
  closes_at             timestamptz not null,
  deadline_time         text not null,
  preco_por_nome        integer not null,
  bureaus               text[] not null,
  referencia_protocolo  text,
  numero_processo       text,
  vara_tribunal         text,
  juiz                  text,
  data_protocolo        timestamptz,
  data_distribuicao     text,
  liminar_status        text,
  concluido_em          timestamptz,
  created_at            timestamptz not null default now()
);
create index if not exists lotes_tenant_idx on lotes (tenant_id);

create table if not exists associados (
  id                    text primary key,
  tenant_id             text not null,
  parceiro_id           text not null,
  nome                  text not null,
  cpf_cnpj_raw          text not null,
  cpf_cnpj              text not null,
  tipo_documento        text not null,
  telefone_whatsapp     text not null,
  email                 text,
  status_filiacao       text not null,
  filiado_em            timestamptz,
  consentimento_em      timestamptz,
  consentimento_ip      text,
  consentimento_hash    text,
  ficha_documento_id    text,
  created_at            timestamptz not null default now()
);
create index if not exists associados_tenant_idx on associados (tenant_id);
create index if not exists associados_parceiro_idx on associados (tenant_id, parceiro_id);

create table if not exists registros (
  id                        text primary key,
  tenant_id                 text not null,
  lote_id                   text not null references lotes (id),
  parceiro_id               text not null,
  -- Sem FK pra associados: o cadastro avulso de registro (addRegistro) ainda
  -- não cria o Associado correspondente (mesmo comportamento do protótipo
  -- original) — ver nota em store.ts.
  associado_id              text not null,
  submissao_id              text,
  nome                      text not null,
  cpf_cnpj_raw              text not null,
  cpf_cnpj                  text not null,
  tipo_documento            text not null,
  process_status            text not null,
  is_locked                 boolean not null default false,
  observacoes_internas      text,
  unit_price                integer not null,
  is_bonus                  boolean not null default false,
  protocol_code             text,
  reprotocol_of_registro_id text,
  origem                    text not null,
  enviado_em                timestamptz,
  protocolado_em            timestamptz,
  baixado_em                timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists registros_tenant_idx on registros (tenant_id);
create index if not exists registros_lote_idx on registros (tenant_id, lote_id);
create index if not exists registros_submissao_idx on registros (tenant_id, submissao_id);
create index if not exists registros_parceiro_idx on registros (tenant_id, parceiro_id);

create table if not exists submissoes (
  id                    text primary key,
  tenant_id             text not null,
  parceiro_id           text not null,
  lote_id               text not null references lotes (id),
  nomes_count           integer not null,
  valor_total           integer not null,
  payment_status        text not null,
  submetido_em          timestamptz not null,
  confirmado_em         timestamptz,
  revisado_por_user_id  text,
  reason_code           text,
  motivo_observacao     text
);
create index if not exists submissoes_tenant_idx on submissoes (tenant_id);

create table if not exists process_events (
  id            text primary key,
  tenant_id     text not null,
  registro_id   text not null references registros (id),
  de_status     text,
  para_status   text not null,
  ator_tipo     text not null,
  ator_user_id  text not null,
  motivo        text not null,
  metadata      jsonb,
  ocorrido_em   timestamptz not null default now()
);
create index if not exists process_events_tenant_idx on process_events (tenant_id);
create index if not exists process_events_registro_idx on process_events (tenant_id, registro_id);

create table if not exists audit_log (
  id             text primary key,
  tenant_id      text not null,
  ator_user_id   text not null,
  acao           text not null,
  entidade_tipo  text not null,
  entidade_id    text,
  antes          jsonb,
  depois         jsonb,
  ip             text,
  user_agent     text,
  ocorrido_em    timestamptz not null default now()
);
create index if not exists audit_log_tenant_idx on audit_log (tenant_id);
