-- PIX real (cobranças), automação de avisos por WhatsApp e configuração
-- das regras de automação.

create table if not exists pix_cobrancas (
  id              text primary key,
  tenant_id       text not null,
  submissao_id    text not null references submissoes (id),
  provider        text not null,
  txid            text not null,
  qr_code_base64  text,
  copia_e_cola    text not null,
  valor           integer not null,
  status          text not null default 'pendente',
  expira_em       timestamptz not null,
  criado_em       timestamptz not null default now(),
  confirmado_em   timestamptz
);
create index if not exists pix_cobrancas_submissao_idx on pix_cobrancas (tenant_id, submissao_id);
create unique index if not exists pix_cobrancas_txid_idx on pix_cobrancas (txid);

create table if not exists notificacoes_enviadas (
  id                     text primary key,
  tenant_id              text not null,
  tipo                   text not null,
  destinatario_telefone  text not null,
  associado_id           text,
  referencia_tipo        text,
  referencia_id          text,
  mensagem               text not null,
  provider_message_id    text,
  status                 text not null default 'enviado',
  enviado_em             timestamptz not null default now()
);
create index if not exists notificacoes_tenant_idx on notificacoes_enviadas (tenant_id);
-- índice de deduplicação: "esse tipo de aviso já foi mandado pra essa
-- referência + destinatário?" é a consulta de idempotência do motor de automação.
create index if not exists notificacoes_dedup_idx
  on notificacoes_enviadas (tipo, referencia_tipo, referencia_id, destinatario_telefone);

create table if not exists automacoes_config (
  chave         text primary key,
  tenant_id     text not null,
  ativo         boolean not null default true,
  config        jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);
