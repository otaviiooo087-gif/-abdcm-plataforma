-- ===========================================================================
-- ABDCM — schema completo (Parte 3 da especificação)
--
-- Aplicável a Postgres/Supabase. A Fase 0 roda com repositório em memória
-- (src/store) para dispensar infraestrutura na demonstração; este arquivo é
-- o destino real e já traz as garantias que a aplicação assume:
--   · tenant_id uuid not null em toda tabela de domínio, com índice composto (I9)
--   · process_events e audit_log imutáveis por trigger, não por disciplina (I2)
--   · dinheiro em bigint de centavos, nunca float
--   · enums de verdade no banco, não strings soltas
-- ===========================================================================

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------- enums
create type role_usuario      as enum ('parceiro','conciliador','operador','suporte','financeiro','administrador');
create type process_status    as enum ('pendente','enviado','aguardando_pagamento','pago','reprovado',
                                       'aguardando_protocolo','protocolado','baixado','recusado','cancelado');
create type status_lote       as enum ('rascunho','aberto','encerrado','em_protocolo','protocolado','concluido');
create type status_filiacao   as enum ('pre_cadastro','ficha_enviada','ficha_assinada','ativo','inativo');
create type status_pagamento  as enum ('pendente','pago','expirado','reprovado','cancelado');
create type tipo_documento    as enum ('cpf','cnpj');
create type ator_tipo         as enum ('parceiro','admin','system','integracao');
create type origem_registro   as enum ('manual','planilha','reprotocolo','bonus');
create type direcao_mensagem  as enum ('entrada','saida');
create type canal_notificacao as enum ('in_app','email','whatsapp');

-- ------------------------------------------------------------------- tenants
create table tenants (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  slug       text not null unique,
  config     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --------------------------------------------------------------------- users
create table users (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id),
  email             text not null,
  password_hash     text,                    -- nulo quando a identidade vem do Supabase Auth
  role              role_usuario not null,
  is_active         boolean not null default true,
  email_verified_at timestamptz,
  last_login_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, email)
);

-- ----------------------------------------------------------------- parceiros
create table parceiros (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references tenants(id),
  user_id                 uuid not null references users(id),
  nome_completo           text not null,
  nome_exibicao           text not null,
  razao_social            text,
  cpf_cnpj                text not null,
  ddd                     text,
  whatsapp                text,
  cep                     text, rua text, numero text, cidade text, uf text,
  partner_code            text not null,
  indicado_por_parceiro_id uuid references parceiros(id),
  preco_por_nome          bigint check (preco_por_nome is null or preco_por_nome >= 0), -- centavos; nulo herda
  total_nomes_enviados    integer not null default 0,
  contrato_aceito_em      timestamptz,
  contrato_versao         text,
  assinatura_status       text,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (tenant_id, partner_code)
);
create index on parceiros (tenant_id, is_active);

-- ---------------------------------------------------------------- associados
create table associados (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id),
  parceiro_id        uuid not null references parceiros(id),
  nome               text not null,
  cpf_cnpj           text not null,
  cpf_cnpj_raw       text not null,
  tipo_documento     tipo_documento not null,
  telefone_whatsapp  text not null,
  email              text,
  status_filiacao    status_filiacao not null default 'pre_cadastro',
  filiado_em         timestamptz,
  consentimento_em   timestamptz,
  consentimento_ip   inet,
  consentimento_hash text,
  ficha_documento_id uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- identidade do bot de WhatsApp: um telefone resolve um único associado (I7)
  unique (tenant_id, telefone_whatsapp)
);
create index on associados (tenant_id, cpf_cnpj_raw);
create index on associados (tenant_id, parceiro_id);

-- --------------------------------------------------------------------- lotes
create table lotes (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id),
  nome                  text not null,
  numero_sequencial     integer not null,
  status                status_lote not null default 'rascunho',
  abre_em               timestamptz not null,
  closes_at             timestamptz not null,
  deadline_time         time,
  preco_por_nome        bigint not null check (preco_por_nome >= 0),
  bureaus               text[] not null default '{}',
  referencia_protocolo  text,
  concluido_em          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (tenant_id, numero_sequencial)
);
create index on lotes (tenant_id, status);

-- ----------------------------------------------------------------- submissoes
create table submissoes (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id),
  parceiro_id          uuid not null references parceiros(id),
  lote_id              uuid not null references lotes(id),
  nomes_count          integer not null check (nomes_count > 0),
  valor_total          bigint not null check (valor_total >= 0),
  payment_status       status_pagamento not null default 'pendente',
  submetido_em         timestamptz not null default now(),
  confirmado_em        timestamptz,
  revisado_por_user_id uuid references users(id),
  reason_code          text,
  motivo_observacao    text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- I11: reprovação exige código de motivo E observação, garantido no banco
  constraint motivo_completo_quando_reprovado check (
    payment_status <> 'reprovado'
    or (reason_code is not null and coalesce(length(motivo_observacao), 0) > 0)
  )
);
create index on submissoes (tenant_id, payment_status);
create index on submissoes (tenant_id, lote_id);

-- ------------------------------------------------------------------ registros
create table registros (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references tenants(id),
  lote_id                   uuid not null references lotes(id),
  parceiro_id               uuid not null references parceiros(id),
  associado_id              uuid not null references associados(id),
  submissao_id              uuid references submissoes(id),
  nome                      text not null,
  cpf_cnpj                  text not null,
  cpf_cnpj_raw              text not null,
  tipo_documento            tipo_documento not null,
  process_status            process_status not null default 'pendente',
  is_locked                 boolean not null default false,
  observacoes_internas      text,
  unit_price                bigint not null check (unit_price >= 0), -- congelado no envio (I4)
  is_bonus                  boolean not null default false,
  protocol_code             text,
  reprotocol_of_registro_id uuid references registros(id),
  origem                    origem_registro not null default 'manual',
  enviado_em                timestamptz,
  protocolado_em            timestamptz,
  baixado_em                timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint bonus_sem_custo check (not is_bonus or unit_price = 0)
);
create index on registros (tenant_id, lote_id, process_status);
create index on registros (tenant_id, parceiro_id);
create index on registros (tenant_id, cpf_cnpj_raw);
create unique index on registros (tenant_id, protocol_code) where protocol_code is not null;

-- I4: o preço congelado não muda depois de gravado. Correção existe apenas
-- como lançamento de ajuste no ledger.
create or replace function impedir_alteracao_unit_price() returns trigger as $$
begin
  if new.unit_price is distinct from old.unit_price then
    raise exception 'unit_price é congelado no envio e imutável (invariante I4)';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger registros_unit_price_imutavel
  before update on registros
  for each row execute function impedir_alteracao_unit_price();

-- -------------------------------------------------------------- pix_cobrancas
create table pix_cobrancas (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id),
  submissao_id    uuid not null references submissoes(id),
  provider        text not null,
  txid            text not null unique,
  valor           bigint not null check (valor > 0),
  copia_e_cola    text not null,
  qrcode_path     text,
  expira_em       timestamptz not null,
  status          status_pagamento not null default 'pendente',
  pago_em         timestamptz,
  payload_webhook jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on pix_cobrancas (tenant_id, status);

-- ------------------------------------------------------------- process_events
-- I2: toda transição de status grava um evento, e o evento é imutável.
create table process_events (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id),
  registro_id   uuid not null references registros(id),
  de_status     process_status not null,
  para_status   process_status not null,
  ator_tipo     ator_tipo not null,
  ator_user_id  uuid references users(id),
  motivo        text,
  reason_code   text,
  metadata      jsonb not null default '{}'::jsonb,
  ocorrido_em   timestamptz not null default now()
);
create index on process_events (tenant_id, registro_id, ocorrido_em);

create or replace function bloquear_escrita_imutavel() returns trigger as $$
begin
  raise exception 'A tabela % é imutável: apenas inserção é permitida.', tg_table_name;
end;
$$ language plpgsql;

create trigger process_events_sem_update before update on process_events
  for each row execute function bloquear_escrita_imutavel();
create trigger process_events_sem_delete before delete on process_events
  for each row execute function bloquear_escrita_imutavel();

-- ---------------------------------------------------------------- documentos
create table documentos (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id),
  owner_type         text not null,
  owner_id           uuid not null,
  kind               text not null,  -- ficha | comprovante_pix | planilha_import | logo | retorno_biro | pacote
  storage_path       text not null,
  nome_original      text,
  mime_type          text,
  size_bytes         bigint,
  status             text,
  reason_code        text,
  versao             integer not null default 1,
  enviado_por_user_id uuid references users(id),
  created_at         timestamptz not null default now()
);
create index on documentos (tenant_id, owner_type, owner_id);

-- --------------------------------------------------------------- assinaturas
create table assinaturas (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id),
  associado_id uuid not null references associados(id),
  provider     text not null,
  envelope_id  text not null,
  status       text not null,  -- enviado | visualizado | assinado | expirado
  assinado_em  timestamptz,
  documento_id uuid references documentos(id),
  created_at   timestamptz not null default now(),
  unique (tenant_id, provider, envelope_id)
);

-- -------------------------------------------------------------- transactions
create table transactions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id),
  parceiro_id     uuid not null references parceiros(id),
  tipo            text not null,  -- cobranca | pagamento | credito_bonus | cobranca_reprotocolo | ajuste | estorno | taxa_assinatura
  valor           bigint not null,
  saldo_apos      bigint not null,
  referencia_tipo text,
  referencia_id   uuid,
  descricao       text,
  reason_code     text,
  created_at      timestamptz not null default now(),
  -- I11: ajuste e estorno só existem com código de motivo
  constraint ajuste_exige_motivo check (tipo not in ('ajuste','estorno') or reason_code is not null)
);
create index on transactions (tenant_id, parceiro_id, created_at);

-- -------------------------------------------------------------- bonus_grants
create table bonus_grants (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id),
  parceiro_id      uuid not null references parceiros(id),
  meta             integer not null,
  nomes_bonus      integer not null,
  nomes_consumidos integer not null default 0,
  concedido_em     timestamptz not null default now(),
  expira_em        timestamptz,
  unique (tenant_id, parceiro_id, meta)
);

-- -------------------------------------------------------------- contestacoes
create table contestacoes (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id),
  parceiro_id         uuid not null references parceiros(id),
  lote_id             uuid not null references lotes(id),
  registro_id         uuid not null references registros(id),
  reason_code         text not null,
  descricao           text not null,
  status              text not null default 'aberta',
  aberta_em           timestamptz not null default now(),
  sla_vence_em        timestamptz not null,
  resolvido_em        timestamptz,
  resolucao           text,
  resolvido_por_user_id uuid references users(id)
);
create index on contestacoes (tenant_id, status, sla_vence_em);

-- ------------------------------------------------------------------ whatsapp
create table whatsapp_conversas (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id),
  associado_id       uuid references associados(id),
  parceiro_id        uuid references parceiros(id),
  telefone           text not null,
  janela_aberta_ate  timestamptz,          -- janela de 24h: texto livre só com ela aberta
  ultima_mensagem_em timestamptz,
  unique (tenant_id, telefone)
);

create table whatsapp_mensagens (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id),
  conversa_id         uuid not null references whatsapp_conversas(id),
  direcao             direcao_mensagem not null,
  tipo                text not null,       -- template | livre
  template_nome       text,
  conteudo            text not null,
  ferramentas_chamadas jsonb not null default '[]'::jsonb,
  status_entrega      text,
  wamid               text unique,
  created_at          timestamptz not null default now(),
  constraint template_exige_nome check (tipo <> 'template' or template_nome is not null)
);
create index on whatsapp_mensagens (tenant_id, conversa_id, created_at);

-- ----------------------------------------------------------- webhook_eventos
create table webhook_eventos (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id),
  provider      text not null,
  evento_id     text not null,
  payload       jsonb not null,
  processado_em timestamptz,
  erro          text,
  tentativas    integer not null default 0,
  created_at    timestamptz not null default now(),
  -- idempotência: o mesmo evento nunca é processado duas vezes
  unique (provider, evento_id)
);

-- ------------------------------------------------------------- pacotes_lote
create table pacotes_lote (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id),
  lote_id           uuid not null references lotes(id),
  tipo              text not null,   -- envio | retorno
  documento_id      uuid references documentos(id),
  checksum          text not null,
  registros_count   integer not null,
  gerado_por_user_id uuid references users(id),
  created_at        timestamptz not null default now()
);

-- ------------------------------------------------------------- notificacoes
create table notificacoes (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id),
  destinatario_tipo text not null,
  destinatario_id   uuid not null,
  canal             canal_notificacao not null,
  evento_tipo       text not null,
  template_nome     text,
  titulo            text,
  corpo             text,
  payload           jsonb not null default '{}'::jsonb,
  lida_em           timestamptz,
  enviada_em        timestamptz,
  erro              text,
  created_at        timestamptz not null default now()
);
create index on notificacoes (tenant_id, destinatario_tipo, destinatario_id, lida_em);

-- --------------------------------------------------- configuração e features
create table system_config (
  tenant_id      uuid not null references tenants(id),
  key            text not null,
  value          jsonb not null,
  descricao      text,
  atualizado_por uuid references users(id),
  updated_at     timestamptz not null default now(),
  primary key (tenant_id, key)
);

create table feature_flags (
  tenant_id                uuid not null references tenants(id),
  key                      text not null,
  habilitado_global        boolean not null default false,
  habilitado_para_roles    text[] not null default '{}',
  habilitado_para_parceiros uuid[] not null default '{}',
  primary key (tenant_id, key)
);

-- ----------------------------------------------------------------- auditoria
create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id),
  ator_user_id  uuid references users(id),
  acao          text not null,
  entidade_tipo text not null,
  entidade_id   uuid,
  antes         jsonb,
  depois        jsonb,
  ip            inet,
  user_agent    text,
  ocorrido_em   timestamptz not null default now()
);
create index on audit_log (tenant_id, ocorrido_em desc);
create index on audit_log (tenant_id, ator_user_id, acao);

create trigger audit_log_sem_update before update on audit_log
  for each row execute function bloquear_escrita_imutavel();
create trigger audit_log_sem_delete before delete on audit_log
  for each row execute function bloquear_escrita_imutavel();
