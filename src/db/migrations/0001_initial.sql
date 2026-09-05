-- ==============================================================================
-- Migration 0001: Initial Domain Schema — Plataforma ABDCM
-- Regra I9: tenant_id (uuid, not null) em TODA tabela de domínio com índices compostos.
-- Regra I2: process_events imutável.
-- Regra I10: Sem credenciais versionadas.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. tenants
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role);

-- 3. parceiros
CREATE TABLE IF NOT EXISTS parceiros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    nome_completo TEXT NOT NULL,
    nome_exibicao TEXT NOT NULL,
    razao_social TEXT,
    cpf_cnpj TEXT NOT NULL,
    ddd TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    cep TEXT NOT NULL,
    rua TEXT NOT NULL,
    numero TEXT NOT NULL,
    cidade TEXT NOT NULL,
    uf TEXT NOT NULL,
    partner_code TEXT NOT NULL,
    indicado_por_parceiro_id UUID REFERENCES parceiros(id),
    preco_por_nome INTEGER, -- centavos
    total_nomes_enviados INTEGER NOT NULL DEFAULT 0,
    contrato_aceito_em TIMESTAMPTZ,
    contrato_versao TEXT,
    assinatura_status TEXT NOT NULL DEFAULT 'ativo',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_parceiros_tenant_user ON parceiros(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_parceiros_tenant_code ON parceiros(tenant_id, partner_code);

-- 4. associados
CREATE TABLE IF NOT EXISTS associados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    parceiro_id UUID NOT NULL REFERENCES parceiros(id) ON DELETE RESTRICT,
    nome TEXT NOT NULL,
    cpf_cnpj TEXT NOT NULL,
    cpf_cnpj_raw TEXT NOT NULL,
    tipo_documento TEXT NOT NULL,
    telefone_whatsapp TEXT NOT NULL,
    email TEXT,
    status_filiacao TEXT NOT NULL DEFAULT 'pre_cadastro',
    filiado_em TIMESTAMPTZ,
    consentimento_em TIMESTAMPTZ,
    consentimento_ip TEXT,
    consentimento_hash TEXT,
    ficha_documento_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_associados_tenant_phone ON associados(tenant_id, telefone_whatsapp);
CREATE INDEX IF NOT EXISTS idx_associados_tenant_doc_raw ON associados(tenant_id, cpf_cnpj_raw);
CREATE INDEX IF NOT EXISTS idx_associados_tenant_parceiro ON associados(tenant_id, parceiro_id);

-- 5. lotes
CREATE TABLE IF NOT EXISTS lotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    nome TEXT NOT NULL,
    numero_sequencial INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberto',
    abre_em TIMESTAMPTZ NOT NULL,
    closes_at TIMESTAMPTZ NOT NULL,
    deadline_time TEXT NOT NULL DEFAULT '23:59:59',
    preco_por_nome INTEGER NOT NULL, -- centavos
    bureaus TEXT[] NOT NULL,
    referencia_protocolo TEXT,
    concluido_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lotes_tenant_status ON lotes(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_lotes_tenant_seq ON lotes(tenant_id, numero_sequencial);

-- 6. submissoes
CREATE TABLE IF NOT EXISTS submissoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    parceiro_id UUID NOT NULL REFERENCES parceiros(id) ON DELETE RESTRICT,
    lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE RESTRICT,
    nomes_count INTEGER NOT NULL,
    valor_total INTEGER NOT NULL, -- centavos
    payment_status TEXT NOT NULL DEFAULT 'pendente',
    submetido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmado_em TIMESTAMPTZ,
    revisado_por_user_id UUID REFERENCES users(id),
    reason_code TEXT,
    motivo_observacao TEXT
);
CREATE INDEX IF NOT EXISTS idx_submissoes_tenant_parceiro ON submissoes(tenant_id, parceiro_id);
CREATE INDEX IF NOT EXISTS idx_submissoes_tenant_lote ON submissoes(tenant_id, lote_id);

-- 7. registros
CREATE TABLE IF NOT EXISTS registros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE RESTRICT,
    parceiro_id UUID NOT NULL REFERENCES parceiros(id) ON DELETE RESTRICT,
    associado_id UUID NOT NULL REFERENCES associados(id) ON DELETE RESTRICT,
    submissao_id UUID REFERENCES submissoes(id),
    nome TEXT NOT NULL,
    cpf_cnpj TEXT NOT NULL,
    cpf_cnpj_raw TEXT NOT NULL,
    tipo_documento TEXT NOT NULL,
    process_status TEXT NOT NULL DEFAULT 'pendente',
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    observacoes_internas TEXT,
    unit_price INTEGER NOT NULL, -- centavos congelados
    is_bonus BOOLEAN NOT NULL DEFAULT FALSE,
    protocol_code TEXT,
    reprotocol_of_registro_id UUID REFERENCES registros(id),
    origem TEXT NOT NULL DEFAULT 'manual',
    enviado_em TIMESTAMPTZ,
    protocolado_em TIMESTAMPTZ,
    baixado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_registros_tenant_lote ON registros(tenant_id, lote_id);
CREATE INDEX IF NOT EXISTS idx_registros_tenant_status ON registros(tenant_id, process_status);
CREATE INDEX IF NOT EXISTS idx_registros_tenant_associado ON registros(tenant_id, associado_id);
CREATE INDEX IF NOT EXISTS idx_registros_tenant_parceiro ON registros(tenant_id, parceiro_id);

-- 8. process_events (IMUTÁVEL)
CREATE TABLE IF NOT EXISTS process_events (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    registro_id UUID NOT NULL REFERENCES registros(id) ON DELETE RESTRICT,
    de_status TEXT,
    para_status TEXT NOT NULL,
    ator_tipo TEXT NOT NULL,
    ator_user_id TEXT NOT NULL,
    motivo TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_process_events_tenant_reg ON process_events(tenant_id, registro_id);
CREATE INDEX IF NOT EXISTS idx_process_events_tenant_time ON process_events(tenant_id, ocorrido_em);

-- 9. pix_cobrancas
CREATE TABLE IF NOT EXISTS pix_cobrancas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    submissao_id UUID NOT NULL REFERENCES submissoes(id) ON DELETE RESTRICT,
    provider TEXT NOT NULL DEFAULT 'mock',
    txid TEXT NOT NULL UNIQUE,
    valor INTEGER NOT NULL, -- centavos
    copia_e_cola TEXT NOT NULL,
    qrcode_path TEXT,
    expira_em TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente',
    pago_em TIMESTAMPTZ,
    payload_webhook JSONB
);
CREATE INDEX IF NOT EXISTS idx_pix_tenant_submissao ON pix_cobrancas(tenant_id, submissao_id);

-- 10. documentos
CREATE TABLE IF NOT EXISTS documentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    owner_type TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    nome_original TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'valido',
    reason_code TEXT,
    versao INTEGER NOT NULL DEFAULT 1,
    enviado_por_user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. assinaturas
CREATE TABLE IF NOT EXISTS assinaturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    associado_id UUID NOT NULL REFERENCES associados(id) ON DELETE RESTRICT,
    provider TEXT NOT NULL,
    envelope_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'enviado',
    assinado_em TIMESTAMPTZ,
    documento_id UUID REFERENCES documentos(id)
);

-- 12. transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    parceiro_id UUID NOT NULL REFERENCES parceiros(id) ON DELETE RESTRICT,
    tipo TEXT NOT NULL,
    valor INTEGER NOT NULL,
    saldo_apos INTEGER NOT NULL,
    referencia_tipo TEXT,
    referencia_id TEXT,
    descricao TEXT NOT NULL,
    reason_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. bonus_grants
CREATE TABLE IF NOT EXISTS bonus_grants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    parceiro_id UUID NOT NULL REFERENCES parceiros(id) ON DELETE RESTRICT,
    meta INTEGER NOT NULL,
    nomes_bonus INTEGER NOT NULL,
    nomes_consumidos INTEGER NOT NULL DEFAULT 0,
    concedido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expira_em TIMESTAMPTZ
);

-- 14. contestacoes
CREATE TABLE IF NOT EXISTS contestacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    parceiro_id UUID NOT NULL REFERENCES parceiros(id) ON DELETE RESTRICT,
    lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE RESTRICT,
    registro_id UUID NOT NULL REFERENCES registros(id) ON DELETE RESTRICT,
    reason_code TEXT NOT NULL,
    descricao TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberta',
    sla_vence_em TIMESTAMPTZ NOT NULL,
    resolvido_em TIMESTAMPTZ,
    resolucao TEXT,
    resolvido_por_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. whatsapp_conversas
CREATE TABLE IF NOT EXISTS whatsapp_conversas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    associado_id UUID REFERENCES associados(id),
    parceiro_id UUID REFERENCES parceiros(id),
    telefone TEXT NOT NULL,
    janela_aberta_ate TIMESTAMPTZ,
    ultima_mensagem_em TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_wpp_tenant_tel ON whatsapp_conversas(tenant_id, telefone);

-- 16. whatsapp_mensagens
CREATE TABLE IF NOT EXISTS whatsapp_mensagens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    conversa_id UUID NOT NULL REFERENCES whatsapp_conversas(id) ON DELETE RESTRICT,
    direcao TEXT NOT NULL,
    tipo TEXT NOT NULL,
    template_nome TEXT,
    conteudo TEXT NOT NULL,
    ferramentas_chamadas JSONB,
    status_entrega TEXT NOT NULL DEFAULT 'enviada',
    wamid TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. webhook_eventos
CREATE TABLE IF NOT EXISTS webhook_eventos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    provider TEXT NOT NULL,
    evento_id TEXT NOT NULL UNIQUE,
    payload JSONB NOT NULL,
    processado_em TIMESTAMPTZ,
    erro TEXT,
    tentativas INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. pacotes_lote
CREATE TABLE IF NOT EXISTS pacotes_lote (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE RESTRICT,
    tipo TEXT NOT NULL,
    documento_id UUID REFERENCES documentos(id),
    checksum TEXT NOT NULL,
    registros_count INTEGER NOT NULL,
    gerado_por_user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. notificacoes
CREATE TABLE IF NOT EXISTS notificacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    destinatario_tipo TEXT NOT NULL,
    destinatario_id TEXT NOT NULL,
    canal TEXT NOT NULL,
    evento_tipo TEXT NOT NULL,
    template_nome TEXT,
    titulo TEXT NOT NULL,
    corpo TEXT NOT NULL,
    payload JSONB,
    lida_em TIMESTAMPTZ,
    enviada_em TIMESTAMPTZ,
    erro TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. system_config
CREATE TABLE IF NOT EXISTS system_config (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    descricao TEXT,
    atualizado_por TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(tenant_id, key)
);

-- 21. feature_flags
CREATE TABLE IF NOT EXISTS feature_flags (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    key TEXT NOT NULL,
    habilitado_global BOOLEAN NOT NULL DEFAULT FALSE,
    habilitado_para_roles TEXT[],
    habilitado_para_parceiros UUID[],
    PRIMARY KEY(tenant_id, key)
);

-- 22. audit_log (IMUTÁVEL)
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    ator_user_id TEXT NOT NULL,
    acao TEXT NOT NULL,
    entidade_tipo TEXT NOT NULL,
    entidade_id TEXT NOT NULL,
    antes JSONB,
    depois JSONB,
    ip TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_entidade ON audit_log(tenant_id, entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_ator ON audit_log(tenant_id, ator_user_id);
