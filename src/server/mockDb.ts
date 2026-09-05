/**
 * Armazenamento server-side em memória com validações e seeds da ABDCM
 * Respeita I1 (regras no servidor), I2 (ProcessEvents), I6 (mascaramento), I9 (tenant_id)
 */

import {
  Lote,
  Registro,
  Associado,
  Submissao,
  ProcessEvent,
  AuditLog,
  UserRole,
  ProcessStatus,
} from '../domain/types.js';
import { maskDocument } from '../lib/masking/documentMasker.js';
import { transitionProcessStatus } from '../domain/registros/stateMachine.js';

export const ABDCM_TENANT_ID = 'e0000000-0000-0000-0000-000000000001';

export interface UserSession {
  id: string;
  tenant_id: string;
  nome: string;
  email: string;
  role: UserRole;
  parceiro_id?: string;
  partner_code?: string;
}

export const SEED_USERS: UserSession[] = [
  {
    id: 'usr-parceiro-01',
    tenant_id: ABDCM_TENANT_ID,
    nome: 'Rdz Consultoria Financeira',
    email: 'contato@rdzconsultoria.com.br',
    role: 'parceiro',
    parceiro_id: 'parc-001',
    partner_code: 'PARC-RDZ-001',
  },
  {
    id: 'usr-conciliador-01',
    tenant_id: ABDCM_TENANT_ID,
    nome: 'Mariana Souza (Conciliação)',
    email: 'mariana.conciliacao@abdcm.org.br',
    role: 'conciliador',
  },
  {
    id: 'usr-operador-01',
    tenant_id: ABDCM_TENANT_ID,
    nome: 'Roberto Dias (Operador de Lote)',
    email: 'roberto.operador@abdcm.org.br',
    role: 'operador',
  },
  {
    id: 'usr-suporte-01',
    tenant_id: ABDCM_TENANT_ID,
    nome: 'Fernanda Lima (Suporte & SAC)',
    email: 'fernanda.suporte@abdcm.org.br',
    role: 'suporte',
  },
  {
    id: 'usr-financeiro-01',
    tenant_id: ABDCM_TENANT_ID,
    nome: 'Lucas Mendes (Controladoria)',
    email: 'lucas.financeiro@abdcm.org.br',
    role: 'financeiro',
  },
  {
    id: 'usr-admin-01',
    tenant_id: ABDCM_TENANT_ID,
    nome: 'Dra. Helena Valente (Administrador Geral)',
    email: 'helena.admin@abdcm.org.br',
    role: 'administrador',
  },
];

// Seed Lotes (Ações Coletivas da ABDCM com dados judiciais completos)
export const SEED_LOTES: Lote[] = [
  {
    id: 'lote-124',
    tenant_id: ABDCM_TENANT_ID,
    nome: 'AÇÃO COLETIVA 124',
    codigo: 'AC 124',
    numero_sequencial: 124,
    status: 'aberto',
    abre_em: '2026-09-01T08:00:00Z',
    closes_at: '2026-09-10T23:59:59Z',
    deadline_time: '23:59:59',
    preco_por_nome: 5500, // R$ 55,00 por nome associado
    bureaus: ['Serasa Experian', 'SPC Brasil', 'Boa Vista SCPC', 'Cenprot BR', 'Cenprot SP'],
    referencia_protocolo: '2026.888.10124',
    numero_processo: '1024567-89.2026.4.03.6100',
    vara_tribunal: '1ª Vara Cível Federal - Seção Judiciária SP',
    juiz: 'Dr. Paulo Rogério da Silva',
    data_protocolo: '2026-09-11T14:00:00Z',
    data_distribuicao: 'Prevista para 11/09/2026',
    liminar_status: 'Em captação e conciliação de nomes',
    created_at: '2026-09-01T08:00:00Z',
  },
  {
    id: 'lote-123',
    tenant_id: ABDCM_TENANT_ID,
    nome: 'AÇÃO COLETIVA 123',
    codigo: 'AC 123',
    numero_sequencial: 123,
    status: 'protocolado',
    abre_em: '2026-08-20T08:00:00Z',
    closes_at: '2026-08-28T23:59:59Z',
    deadline_time: '23:59:59',
    preco_por_nome: 5500,
    bureaus: ['Serasa Experian', 'SPC Brasil', 'Boa Vista SCPC', 'Cenprot BR'],
    referencia_protocolo: '2026.888.10123',
    numero_processo: '1022134-45.2026.4.03.6100',
    vara_tribunal: '4ª Vara Cível Federal - Seção Judiciária SP',
    juiz: 'Dra. Cláudia Mantovani',
    data_protocolo: '2026-08-29T16:30:00Z',
    data_distribuicao: '29/08/2026',
    liminar_status: 'Liminar deferida - Ofícios aos birôs expedidos',
    created_at: '2026-08-20T08:00:00Z',
  },
  {
    id: 'lote-122',
    tenant_id: ABDCM_TENANT_ID,
    nome: 'AÇÃO COLETIVA 122',
    codigo: 'AC 122',
    numero_sequencial: 122,
    status: 'concluido',
    abre_em: '2026-08-05T08:00:00Z',
    closes_at: '2026-08-14T23:59:59Z',
    deadline_time: '23:59:59',
    preco_por_nome: 5500,
    bureaus: ['Serasa Experian', 'SPC Brasil', 'Boa Vista SCPC', 'Cenprot SP'],
    referencia_protocolo: '2026.888.10122',
    numero_processo: '1019876-02.2026.4.03.6100',
    vara_tribunal: '2ª Vara Cível Federal - Seção Judiciária SP',
    juiz: 'Dr. Fernando Albuquerque',
    data_protocolo: '2026-08-15T11:20:00Z',
    data_distribuicao: '15/08/2026',
    liminar_status: 'Baixas consumadas nos 4 birôs e arquivado',
    concluido_em: '2026-08-30T14:00:00Z',
    created_at: '2026-08-05T08:00:00Z',
  },
  {
    id: 'lote-121',
    tenant_id: ABDCM_TENANT_ID,
    nome: 'AÇÃO COLETIVA 121',
    codigo: 'AC 121',
    numero_sequencial: 121,
    status: 'concluido',
    abre_em: '2026-07-20T08:00:00Z',
    closes_at: '2026-07-29T23:59:59Z',
    deadline_time: '23:59:59',
    preco_por_nome: 5500,
    bureaus: ['Serasa Experian', 'SPC Brasil', 'Boa Vista SCPC'],
    referencia_protocolo: '2026.888.10121',
    numero_processo: '1017654-33.2026.4.03.6100',
    vara_tribunal: '5ª Vara Cível Federal - Seção Judiciária SP',
    juiz: 'Dra. Beatriz Guimarães',
    data_protocolo: '2026-07-30T10:00:00Z',
    data_distribuicao: '30/07/2026',
    liminar_status: '100% dos associados baixados com sucesso',
    concluido_em: '2026-08-12T15:00:00Z',
    created_at: '2026-07-20T08:00:00Z',
  },
];

// Seed Associados
export const SEED_ASSOCIADOS: Associado[] = [
  {
    id: 'assoc-001',
    tenant_id: ABDCM_TENANT_ID,
    parceiro_id: 'parc-001',
    nome: 'Ana Carolina Peixoto',
    cpf_cnpj_raw: '54289174092',
    cpf_cnpj: maskDocument('54289174092'),
    tipo_documento: 'cpf',
    telefone_whatsapp: '+5511987654321',
    email: 'ana.peixoto@email.com',
    status_filiacao: 'ativo',
    filiado_em: '2026-08-25T10:00:00Z',
    consentimento_em: '2026-08-25T10:15:30Z',
    consentimento_ip: '189.40.12.85',
    consentimento_hash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    created_at: '2026-08-25T10:00:00Z',
  },
  {
    id: 'assoc-002',
    tenant_id: ABDCM_TENANT_ID,
    parceiro_id: 'parc-001',
    nome: 'Marcos Vinícius Barbosa',
    cpf_cnpj_raw: '38194027015',
    cpf_cnpj: maskDocument('38194027015'),
    tipo_documento: 'cpf',
    telefone_whatsapp: '+5511976543210',
    email: 'marcos.barbosa@email.com',
    status_filiacao: 'ativo',
    filiado_em: '2026-08-26T14:20:00Z',
    consentimento_em: '2026-08-26T14:30:11Z',
    consentimento_ip: '201.83.45.112',
    consentimento_hash: 'sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
    created_at: '2026-08-26T14:20:00Z',
  },
  {
    id: 'assoc-003',
    tenant_id: ABDCM_TENANT_ID,
    parceiro_id: 'parc-001',
    nome: 'Juliana Fagundes Vieira',
    cpf_cnpj_raw: '71928304068',
    cpf_cnpj: maskDocument('71928304068'),
    tipo_documento: 'cpf',
    telefone_whatsapp: '+5511965432109',
    email: 'juliana.vieira@email.com',
    status_filiacao: 'ficha_enviada',
    created_at: '2026-09-02T11:00:00Z',
  },
  {
    id: 'assoc-004',
    tenant_id: ABDCM_TENANT_ID,
    parceiro_id: 'parc-001',
    nome: 'Restaurante & Buffet Alvorada LTDA',
    cpf_cnpj_raw: '45812903000189',
    cpf_cnpj: maskDocument('45812903000189'),
    tipo_documento: 'cnpj',
    telefone_whatsapp: '+5511954321098',
    email: 'contato@buffetalvorada.com.br',
    status_filiacao: 'ativo',
    filiado_em: '2026-08-29T16:00:00Z',
    consentimento_em: '2026-08-29T16:22:05Z',
    consentimento_ip: '177.19.88.3',
    consentimento_hash: 'sha256:a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
    created_at: '2026-08-29T16:00:00Z',
  },
];

// Seed Registros (19 nomes da Ação Limpa Nome ABDCM conforme telas reais)
export const SEED_REGISTROS: Registro[] = [
  {
    id: 'reg-001',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-124',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-001',
    nome: 'Felipe Pereira',
    cpf_cnpj_raw: '39771462890',
    cpf_cnpj: '397.714.628-90',
    tipo_documento: 'cpf',
    process_status: 'pendente',
    is_locked: false,
    unit_price: 25000,
    is_bonus: false,
    protocol_code: 'ABDCM-AC124-001-FP',
    origem: 'manual',
    created_at: '2026-09-02T10:00:00Z',
    updated_at: '2026-09-02T10:00:00Z',
  },
  {
    id: 'reg-002',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-124',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-002',
    nome: 'MARIA HELENA DE OLIVEIRA',
    cpf_cnpj_raw: '33796124000184',
    cpf_cnpj: '33.796.124/0001-84',
    tipo_documento: 'cnpj',
    process_status: 'pendente',
    is_locked: false,
    unit_price: 25000,
    is_bonus: false,
    protocol_code: 'ABDCM-AC124-002-MHO',
    origem: 'manual',
    created_at: '2026-09-02T10:15:00Z',
    updated_at: '2026-09-02T10:15:00Z',
  },
  {
    id: 'reg-003',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-124',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-003',
    nome: 'NILSON ZANETONI PRADO',
    cpf_cnpj_raw: '15737085000162',
    cpf_cnpj: '15.737.085/0001-62',
    tipo_documento: 'cnpj',
    process_status: 'pendente',
    is_locked: false,
    unit_price: 25000,
    is_bonus: false,
    protocol_code: 'ABDCM-AC124-003-NZP',
    origem: 'manual',
    created_at: '2026-09-02T10:30:00Z',
    updated_at: '2026-09-02T10:30:00Z',
  },
  {
    id: 'reg-004',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-124',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-004',
    nome: 'Geyser Fernandes Lima',
    cpf_cnpj_raw: '21484431863',
    cpf_cnpj: '214.844.318-63',
    tipo_documento: 'cpf',
    process_status: 'pendente',
    is_locked: false,
    unit_price: 25000,
    is_bonus: false,
    protocol_code: 'ABDCM-AC124-004-GFL',
    origem: 'manual',
    created_at: '2026-09-02T11:00:00Z',
    updated_at: '2026-09-02T11:00:00Z',
  },
  {
    id: 'reg-005',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-124',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-005',
    nome: 'Pedro Augusto Medeiros oliveira',
    cpf_cnpj_raw: '01889899607',
    cpf_cnpj: '018.898.996-07',
    tipo_documento: 'cpf',
    process_status: 'pendente',
    is_locked: false,
    unit_price: 25000,
    is_bonus: false,
    protocol_code: 'ABDCM-AC124-005-PMO',
    origem: 'manual',
    created_at: '2026-09-02T11:20:00Z',
    updated_at: '2026-09-02T11:20:00Z',
  },
  {
    id: 'reg-006',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-124',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-006',
    nome: 'Valdinei Alves Bassi',
    cpf_cnpj_raw: '38228202881',
    cpf_cnpj: '382.282.028-81',
    tipo_documento: 'cpf',
    process_status: 'pendente',
    is_locked: false,
    unit_price: 25000,
    is_bonus: false,
    protocol_code: 'ABDCM-AC124-006-VAB',
    origem: 'manual',
    created_at: '2026-09-02T11:40:00Z',
    updated_at: '2026-09-02T11:40:00Z',
  },
  {
    id: 'reg-007',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-124',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-007',
    nome: 'Adilma Silva Dos Santos Guedes',
    cpf_cnpj_raw: '30891579850',
    cpf_cnpj: '308.915.798-50',
    tipo_documento: 'cpf',
    process_status: 'pendente',
    is_locked: false,
    unit_price: 25000,
    is_bonus: false,
    protocol_code: 'ABDCM-AC124-007-ASG',
    origem: 'manual',
    created_at: '2026-09-02T12:00:00Z',
    updated_at: '2026-09-02T12:00:00Z',
  },
  {
    id: 'reg-008',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-124',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-008',
    nome: 'Jonas Tadei Sandes',
    cpf_cnpj_raw: '36459274843',
    cpf_cnpj: '364.592.748-43',
    tipo_documento: 'cpf',
    process_status: 'pendente',
    is_locked: false,
    unit_price: 25000,
    is_bonus: false,
    protocol_code: 'ABDCM-AC124-008-JTS',
    origem: 'manual',
    created_at: '2026-09-02T12:15:00Z',
    updated_at: '2026-09-02T12:15:00Z',
  },
  {
    id: 'reg-009',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-124',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-009',
    nome: 'LEANDRO ROGERIO LIMA DA SILVA',
    cpf_cnpj_raw: '21539881888',
    cpf_cnpj: '215.398.818-88',
    tipo_documento: 'cpf',
    process_status: 'pendente',
    is_locked: false,
    unit_price: 25000,
    is_bonus: false,
    protocol_code: 'ABDCM-AC124-009-LRS',
    origem: 'planilha',
    created_at: '2026-09-04T08:00:00Z',
    updated_at: '2026-09-04T08:00:00Z',
  },
  {
    id: 'reg-010',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-124',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-010',
    nome: 'Allanis Calheiros Lucas Da Silva',
    cpf_cnpj_raw: '51512345678',
    cpf_cnpj: '515.123.456-78',
    tipo_documento: 'cpf',
    process_status: 'pendente',
    is_locked: false,
    unit_price: 25000,
    is_bonus: false,
    protocol_code: 'ABDCM-AC124-010-ACS',
    origem: 'planilha',
    created_at: '2026-09-04T08:00:00Z',
    updated_at: '2026-09-04T08:00:00Z',
  },
  {
    id: 'reg-011',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-124',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-011',
    nome: 'Fabio Alexandre De Almeida',
    cpf_cnpj_raw: '29987654321',
    cpf_cnpj: '299.876.543-21',
    tipo_documento: 'cpf',
    process_status: 'pendente',
    is_locked: false,
    unit_price: 25000,
    is_bonus: false,
    protocol_code: 'ABDCM-AC124-011-FAA',
    origem: 'planilha',
    created_at: '2026-09-04T08:00:00Z',
    updated_at: '2026-09-04T08:00:00Z',
  },
  {
    id: 'reg-012',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-124',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-012',
    nome: 'Herick Luiz Castilho Messias',
    cpf_cnpj_raw: '22745678901',
    cpf_cnpj: '227.456.789-01',
    tipo_documento: 'cpf',
    process_status: 'pendente',
    is_locked: false,
    unit_price: 25000,
    is_bonus: false,
    protocol_code: 'ABDCM-AC124-012-HCM',
    origem: 'planilha',
    created_at: '2026-09-04T08:00:00Z',
    updated_at: '2026-09-04T08:00:00Z',
  },
  {
    id: 'reg-013',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-124',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-013',
    nome: 'Walter Augusto Fabri',
    cpf_cnpj_raw: '43678901234',
    cpf_cnpj: '436.789.012-34',
    tipo_documento: 'cpf',
    process_status: 'pendente',
    is_locked: false,
    unit_price: 25000,
    is_bonus: false,
    protocol_code: 'ABDCM-AC124-013-WAF',
    origem: 'planilha',
    created_at: '2026-09-04T08:00:00Z',
    updated_at: '2026-09-04T08:00:00Z',
  },
  {
    id: 'reg-014',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-124',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-014',
    nome: 'Daniela cristina de souza',
    cpf_cnpj_raw: '38923456789',
    cpf_cnpj: '389.234.567-89',
    tipo_documento: 'cpf',
    process_status: 'pendente',
    is_locked: false,
    unit_price: 25000,
    is_bonus: false,
    protocol_code: 'ABDCM-AC124-014-DCS',
    origem: 'planilha',
    created_at: '2026-09-04T08:00:00Z',
    updated_at: '2026-09-04T08:00:00Z',
  },
  {
    id: 'reg-015',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-124',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-015',
    nome: 'Ricardo Santos Neves',
    cpf_cnpj_raw: '41234567890',
    cpf_cnpj: '412.345.678-90',
    tipo_documento: 'cpf',
    process_status: 'pendente',
    is_locked: false,
    unit_price: 25000,
    is_bonus: false,
    protocol_code: 'ABDCM-AC124-015-RSN',
    origem: 'planilha',
    created_at: '2026-09-04T08:00:00Z',
    updated_at: '2026-09-04T08:00:00Z',
  },
  {
    id: 'reg-016',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-124',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-016',
    nome: 'Patricia Mendes de Araujo',
    cpf_cnpj_raw: '19876543210',
    cpf_cnpj: '198.765.432-10',
    tipo_documento: 'cpf',
    process_status: 'pendente',
    is_locked: false,
    unit_price: 25000,
    is_bonus: false,
    protocol_code: 'ABDCM-AC124-016-PMA',
    origem: 'planilha',
    created_at: '2026-09-04T08:00:00Z',
    updated_at: '2026-09-04T08:00:00Z',
  },
  {
    id: 'reg-017',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-124',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-017',
    nome: 'Lucas Gabriel Ribeiro',
    cpf_cnpj_raw: '32165498700',
    cpf_cnpj: '321.654.987-00',
    tipo_documento: 'cpf',
    process_status: 'pendente',
    is_locked: false,
    unit_price: 25000,
    is_bonus: false,
    protocol_code: 'ABDCM-AC124-017-LGR',
    origem: 'planilha',
    created_at: '2026-09-04T08:00:00Z',
    updated_at: '2026-09-04T08:00:00Z',
  },
  {
    id: 'reg-018',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-124',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-018',
    nome: 'Camila Duarte Albuquerque',
    cpf_cnpj_raw: '45678912345',
    cpf_cnpj: '456.789.123-45',
    tipo_documento: 'cpf',
    process_status: 'pendente',
    is_locked: false,
    unit_price: 25000,
    is_bonus: false,
    protocol_code: 'ABDCM-AC124-018-CDA',
    origem: 'planilha',
    created_at: '2026-09-04T08:00:00Z',
    updated_at: '2026-09-04T08:00:00Z',
  },
  {
    id: 'reg-019',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-124',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-019',
    nome: 'Tiago Henrique Martins',
    cpf_cnpj_raw: '23456789012',
    cpf_cnpj: '234.567.890-12',
    tipo_documento: 'cpf',
    process_status: 'pendente',
    is_locked: false,
    unit_price: 25000,
    is_bonus: false,
    protocol_code: 'ABDCM-AC124-019-THM',
    origem: 'planilha',
    created_at: '2026-09-04T08:00:00Z',
    updated_at: '2026-09-04T08:00:00Z',
  },
  // Registros de Ações Anteriores (Ação Coletiva 123 e Ação Coletiva 122)
  {
    id: 'reg-ac123-001',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-123',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-123-01',
    nome: 'Marcos Vinicius Tavares',
    cpf_cnpj_raw: '38192455801',
    cpf_cnpj: '381.924.558-01',
    tipo_documento: 'cpf',
    process_status: 'protocolado',
    is_locked: true,
    unit_price: 5500,
    is_bonus: false,
    protocol_code: 'ABDCM-AC123-001-MVT',
    origem: 'planilha',
    protocolado_em: '2026-08-29T16:30:00Z',
    created_at: '2026-08-22T10:00:00Z',
    updated_at: '2026-08-29T16:30:00Z',
  },
  {
    id: 'reg-ac123-002',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-123',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-123-02',
    nome: 'Sueli Rocha Mendes',
    cpf_cnpj_raw: '27481920394',
    cpf_cnpj: '274.819.203-94',
    tipo_documento: 'cpf',
    process_status: 'protocolado',
    is_locked: true,
    unit_price: 5500,
    is_bonus: false,
    protocol_code: 'ABDCM-AC123-002-SRM',
    origem: 'manual',
    protocolado_em: '2026-08-29T16:30:00Z',
    created_at: '2026-08-23T14:20:00Z',
    updated_at: '2026-08-29T16:30:00Z',
  },
  {
    id: 'reg-ac123-003',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-123',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-123-03',
    nome: 'Empresa Santos Transportes LTDA',
    cpf_cnpj_raw: '19482910000144',
    cpf_cnpj: '19.482.910/0001-44',
    tipo_documento: 'cnpj',
    process_status: 'protocolado',
    is_locked: true,
    unit_price: 5500,
    is_bonus: false,
    protocol_code: 'ABDCM-AC123-003-EST',
    origem: 'planilha',
    protocolado_em: '2026-08-29T16:30:00Z',
    created_at: '2026-08-24T09:10:00Z',
    updated_at: '2026-08-29T16:30:00Z',
  },
  {
    id: 'reg-ac123-004',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-123',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-123-04',
    nome: 'Rodrigo Barreto Leal',
    cpf_cnpj_raw: '41928374655',
    cpf_cnpj: '419.283.746-55',
    tipo_documento: 'cpf',
    process_status: 'protocolado',
    is_locked: true,
    unit_price: 5500,
    is_bonus: false,
    protocol_code: 'ABDCM-AC123-004-RBL',
    origem: 'manual',
    protocolado_em: '2026-08-29T16:30:00Z',
    created_at: '2026-08-25T11:45:00Z',
    updated_at: '2026-08-29T16:30:00Z',
  },
  {
    id: 'reg-ac122-001',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-122',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-122-01',
    nome: 'Geraldo Magela Pires',
    cpf_cnpj_raw: '10928374619',
    cpf_cnpj: '109.283.746-19',
    tipo_documento: 'cpf',
    process_status: 'baixado',
    is_locked: true,
    unit_price: 5500,
    is_bonus: false,
    protocol_code: 'ABDCM-AC122-001-GMP',
    origem: 'manual',
    protocolado_em: '2026-08-15T11:20:00Z',
    baixado_em: '2026-08-30T14:00:00Z',
    created_at: '2026-08-08T10:00:00Z',
    updated_at: '2026-08-30T14:00:00Z',
  },
  {
    id: 'reg-ac122-002',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-122',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-122-02',
    nome: 'Julio Cesar Antunes',
    cpf_cnpj_raw: '30291827364',
    cpf_cnpj: '302.918.273-64',
    tipo_documento: 'cpf',
    process_status: 'baixado',
    is_locked: true,
    unit_price: 5500,
    is_bonus: false,
    protocol_code: 'ABDCM-AC122-002-JCA',
    origem: 'planilha',
    protocolado_em: '2026-08-15T11:20:00Z',
    baixado_em: '2026-08-30T14:00:00Z',
    created_at: '2026-08-09T15:20:00Z',
    updated_at: '2026-08-30T14:00:00Z',
  },
  {
    id: 'reg-ac122-003',
    tenant_id: ABDCM_TENANT_ID,
    lote_id: 'lote-122',
    parceiro_id: 'parc-001',
    associado_id: 'assoc-122-03',
    nome: 'Comércio Alimentos Estrela EIRELI',
    cpf_cnpj_raw: '08918273000155',
    cpf_cnpj: '08.918.273/0001-55',
    tipo_documento: 'cnpj',
    process_status: 'baixado',
    is_locked: true,
    unit_price: 5500,
    is_bonus: false,
    protocol_code: 'ABDCM-AC122-003-CAE',
    origem: 'planilha',
    protocolado_em: '2026-08-15T11:20:00Z',
    baixado_em: '2026-08-30T14:00:00Z',
    created_at: '2026-08-10T11:30:00Z',
    updated_at: '2026-08-30T14:00:00Z',
  },
];

// Seed ProcessEvents
export const SEED_PROCESS_EVENTS: ProcessEvent[] = [
  {
    id: 'pe-001',
    tenant_id: ABDCM_TENANT_ID,
    registro_id: 'reg-001',
    de_status: 'pendente',
    para_status: 'enviado',
    ator_tipo: 'parceiro',
    ator_user_id: 'usr-parceiro-01',
    motivo: 'Submissão de lote para cobrança PIX',
    metadata: { submissao_id: 'sub-001' },
    ocorrido_em: '2026-09-02T14:10:00Z',
  },
  {
    id: 'pe-002',
    tenant_id: ABDCM_TENANT_ID,
    registro_id: 'reg-001',
    de_status: 'enviado',
    para_status: 'pago',
    ator_tipo: 'integracao',
    ator_user_id: 'system-pix',
    motivo: 'Confirmação automática de pagamento PIX (txid: tx_pix_98124912)',
    metadata: { txid: 'tx_pix_98124912', valor_centavos: 9800 },
    ocorrido_em: '2026-09-02T14:15:00Z',
  },
  {
    id: 'pe-003',
    tenant_id: ABDCM_TENANT_ID,
    registro_id: 'reg-003',
    de_status: 'pendente',
    para_status: 'enviado',
    ator_tipo: 'parceiro',
    ator_user_id: 'usr-parceiro-01',
    motivo: 'Envio de lista com 1 nome para pagamento',
    metadata: { submissao_id: 'sub-002' },
    ocorrido_em: '2026-09-03T09:00:00Z',
  },
  {
    id: 'pe-004',
    tenant_id: ABDCM_TENANT_ID,
    registro_id: 'reg-003',
    de_status: 'enviado',
    para_status: 'aguardando_pagamento',
    ator_tipo: 'parceiro',
    ator_user_id: 'usr-parceiro-01',
    motivo: 'Comprovante manual de transferência anexado para conciliação',
    metadata: { documento_tipo: 'comprovante_pix' },
    ocorrido_em: '2026-09-03T09:05:00Z',
  },
];

// Seed AuditLog
export const SEED_AUDIT_LOG: AuditLog[] = [
  {
    id: 'audit-001',
    tenant_id: ABDCM_TENANT_ID,
    ator_user_id: 'usr-admin-01',
    acao: 'SISTEMA_INICIALIZADO',
    entidade_tipo: 'tenants',
    entidade_id: ABDCM_TENANT_ID,
    depois: { nome: 'Associação Brasileira de Defesa do Consumidor e do Trabalhador (ABDCM)' },
    ip: '127.0.0.1',
    user_agent: 'Server Bootstrap',
    ocorrido_em: '2026-09-01T00:00:00Z',
  },
];

// Seed Submissões Financeiras
export const SEED_SUBMISSOES: Submissao[] = [
  {
    id: 'sub-001',
    tenant_id: ABDCM_TENANT_ID,
    parceiro_id: 'parc-001',
    lote_id: 'lote-124',
    nomes_count: 5,
    valor_total: 27500, // R$ 275,00
    payment_status: 'pago',
    submetido_em: '2026-09-02T14:10:00Z',
    confirmado_em: '2026-09-02T14:15:00Z',
    revisado_por_user_id: 'usr-financeiro-01',
    motivo_observacao: 'PIX via Nu Pagamentos S.A. conciliado e aprovado com sucesso',
  },
  {
    id: 'sub-002',
    tenant_id: ABDCM_TENANT_ID,
    parceiro_id: 'parc-001',
    lote_id: 'lote-124',
    nomes_count: 3,
    valor_total: 16500, // R$ 165,00
    payment_status: 'pendente',
    submetido_em: '2026-09-03T09:00:00Z',
    motivo_observacao: 'Comprovante bancário aguardando conferência do operador financeiro',
  },
  {
    id: 'sub-003',
    tenant_id: ABDCM_TENANT_ID,
    parceiro_id: 'parc-001',
    lote_id: 'lote-123',
    nomes_count: 8,
    valor_total: 44000, // R$ 440,00
    payment_status: 'pago',
    submetido_em: '2026-08-25T11:00:00Z',
    confirmado_em: '2026-08-25T11:30:00Z',
    revisado_por_user_id: 'usr-financeiro-01',
    motivo_observacao: 'TED Banco Santander compensada e confirmada em extrato',
  },
  {
    id: 'sub-004',
    tenant_id: ABDCM_TENANT_ID,
    parceiro_id: 'parc-001',
    lote_id: 'lote-122',
    nomes_count: 14,
    valor_total: 77000, // R$ 770,00
    payment_status: 'pago',
    submetido_em: '2026-08-10T15:00:00Z',
    confirmado_em: '2026-08-10T15:20:00Z',
    revisado_por_user_id: 'usr-financeiro-01',
    motivo_observacao: 'Lote liquidado e baixado integralmente nos 4 birôs',
  },
];

/**
 * Repositório em memória que simula a camada de dados server-side
 */
class ServerStore {
  public lotes: Lote[] = [...SEED_LOTES];
  public associados: Associado[] = [...SEED_ASSOCIADOS];
  public registros: Registro[] = [...SEED_REGISTROS];
  public processEvents: ProcessEvent[] = [...SEED_PROCESS_EVENTS];
  public auditLogs: AuditLog[] = [...SEED_AUDIT_LOG];
  public submissoes: Submissao[] = [...SEED_SUBMISSOES];
  public activeUser: UserSession = SEED_USERS[0]; // Inicia como parceiro Rdz Consultoria Financeira

  // Retorna sessão atual
  getSession(): UserSession {
    return this.activeUser;
  }

  setRole(role: UserRole): UserSession {
    const user = SEED_USERS.find((u) => u.role === role) || {
      id: `usr-${role}-auto`,
      tenant_id: ABDCM_TENANT_ID,
      nome: `Usuário (${role})`,
      email: `${role}@abdcm.org.br`,
      role,
    };
    this.activeUser = user;
    return user;
  }

  // Submete lote de registros para processamento (cria Submissão PIX e bloqueia nomes)
  submitBatch(registroIds: string[], atorUserId: string): { submissao: Submissao; registros: Registro[] } {
    if (!registroIds || registroIds.length === 0) {
      throw new Error('Nenhum registro selecionado para envio.');
    }

    const lote = this.lotes.find((l) => l.id === 'lote-124') || this.lotes[0];
    const precoUnitario = lote.preco_por_nome || 25000;
    const submissaoId = `sub-${Date.now()}`;
    const now = new Date().toISOString();

    const submissao: Submissao = {
      id: submissaoId,
      tenant_id: ABDCM_TENANT_ID,
      parceiro_id: 'parc-001',
      lote_id: lote.id,
      nomes_count: registroIds.length,
      valor_total: registroIds.length * precoUnitario,
      payment_status: 'pendente',
      submetido_em: now,
    };

    const updatedList: Registro[] = [];

    for (const regId of registroIds) {
      const idx = this.registros.findIndex((r) => r.id === regId);
      if (idx !== -1) {
        const current = this.registros[idx];
        const deStatus = current.process_status;
        const updated: Registro = {
          ...current,
          submissao_id: submissaoId,
          process_status: 'enviado',
          is_locked: true,
          enviado_em: now,
          updated_at: now,
        };
        this.registros[idx] = updated;
        updatedList.push(updated);

        const event: ProcessEvent = {
          id: `pe-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          tenant_id: current.tenant_id,
          registro_id: current.id,
          de_status: deStatus,
          para_status: 'enviado',
          ator_tipo: 'parceiro',
          ator_user_id: atorUserId,
          motivo: `Envio de lista (${registroIds.length} nomes) para Ação Coletiva 124`,
          metadata: { submissao_id: submissaoId, valor_unitario: precoUnitario },
          ocorrido_em: now,
        };
        this.processEvents.unshift(event);
      }
    }

    this.submissoes.unshift(submissao);

    this.auditLogs.unshift({
      id: `audit_${Date.now()}`,
      tenant_id: ABDCM_TENANT_ID,
      ator_user_id: atorUserId,
      acao: 'ENVIO_LISTA_PROCESSAMENTO',
      entidade_tipo: 'submissoes',
      entidade_id: submissaoId,
      depois: {
        nomes_count: registroIds.length,
        valor_total: submissao.valor_total,
        lote_id: lote.id,
      },
      ip: '127.0.0.1',
      user_agent: 'ABDCM-Parceiro-Portal',
      ocorrido_em: now,
    });

    return { submissao, registros: updatedList };
  }

  // Simula ou confirma pagamento PIX da submissão
  paySubmissao(submissaoId: string, atorUserId: string): { submissao: Submissao; registros: Registro[] } {
    const subIdx = this.submissoes.findIndex((s) => s.id === submissaoId);
    if (subIdx === -1) {
      throw new Error(`Submissão ${submissaoId} não encontrada.`);
    }

    const now = new Date().toISOString();
    const updatedSub: Submissao = {
      ...this.submissoes[subIdx],
      payment_status: 'pago',
      confirmado_em: now,
    };
    this.submissoes[subIdx] = updatedSub;

    const updatedRegistros: Registro[] = [];
    for (let i = 0; i < this.registros.length; i++) {
      if (this.registros[i].submissao_id === submissaoId) {
        const current = this.registros[i];
        const updated: Registro = {
          ...current,
          process_status: 'pago',
          updated_at: now,
        };
        this.registros[i] = updated;
        updatedRegistros.push(updated);

        this.processEvents.unshift({
          id: `pe-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          tenant_id: current.tenant_id,
          registro_id: current.id,
          de_status: 'enviado',
          para_status: 'pago',
          ator_tipo: 'integracao',
          ator_user_id: atorUserId,
          motivo: 'Confirmação de pagamento via PIX instantâneo',
          metadata: { submissao_id: submissaoId },
          ocorrido_em: now,
        });
      }
    }

    return { submissao: updatedSub, registros: updatedRegistros };
  }

  // Aprova submissão (conciliação bancária)
  approveSubmissao(submissaoId: string, atorUserId: string, motivo?: string): { submissao: Submissao; registros: Registro[] } {
    const res = this.paySubmissao(submissaoId, atorUserId);
    if (motivo) {
      res.submissao.motivo_observacao = motivo;
    }
    this.auditLogs.unshift({
      id: `audit_${Date.now()}`,
      tenant_id: ABDCM_TENANT_ID,
      ator_user_id: atorUserId,
      acao: 'APROVACAO_COMPROVANTE_FINANCEIRO',
      entidade_tipo: 'submissoes',
      entidade_id: submissaoId,
      depois: { motivo: motivo || 'Comprovante conferido e aprovado' },
      ip: '127.0.0.1',
      user_agent: 'ABDCM-Admin-Console',
      ocorrido_em: new Date().toISOString(),
    });
    return res;
  }

  // Reprova submissão (comprovante divergente ou ilegível)
  reproveSubmissao(submissaoId: string, atorUserId: string, motivo: string): { submissao: Submissao; registros: Registro[] } {
    const subIdx = this.submissoes.findIndex((s) => s.id === submissaoId);
    if (subIdx === -1) {
      throw new Error(`Submissão ${submissaoId} não encontrada.`);
    }

    const now = new Date().toISOString();
    const updatedSub: Submissao = {
      ...this.submissoes[subIdx],
      payment_status: 'reprovado',
      revisado_por_user_id: atorUserId,
      motivo_observacao: motivo,
    };
    this.submissoes[subIdx] = updatedSub;

    const updatedRegistros: Registro[] = [];
    for (let i = 0; i < this.registros.length; i++) {
      if (this.registros[i].submissao_id === submissaoId) {
        const current = this.registros[i];
        const updated: Registro = {
          ...current,
          process_status: 'reprovado',
          is_locked: false,
          updated_at: now,
        };
        this.registros[i] = updated;
        updatedRegistros.push(updated);

        this.processEvents.unshift({
          id: `pe-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          tenant_id: current.tenant_id,
          registro_id: current.id,
          de_status: current.process_status,
          para_status: 'reprovado',
          ator_tipo: 'admin',
          ator_user_id: atorUserId,
          motivo: motivo || 'Comprovante reprovado na conciliação bancária',
          metadata: { submissao_id: submissaoId },
          ocorrido_em: now,
        });
      }
    }

    this.auditLogs.unshift({
      id: `audit_${Date.now()}`,
      tenant_id: ABDCM_TENANT_ID,
      ator_user_id: atorUserId,
      acao: 'REPROVACAO_COMPROVANTE_FINANCEIRO',
      entidade_tipo: 'submissoes',
      entidade_id: submissaoId,
      depois: { motivo },
      ip: '127.0.0.1',
      user_agent: 'ABDCM-Admin-Console',
      ocorrido_em: now,
    });

    return { submissao: updatedSub, registros: updatedRegistros };
  }

  // Cancela submissão pendente
  cancelSubmissao(submissaoId: string): void {
    const subIdx = this.submissoes.findIndex((s) => s.id === submissaoId);
    if (subIdx !== -1) {
      this.submissoes.splice(subIdx, 1);
    }
    // Desbloqueia os registros associados se ainda não tiverem sido protocolados
    for (let i = 0; i < this.registros.length; i++) {
      if (this.registros[i].submissao_id === submissaoId && this.registros[i].process_status === 'enviado') {
        this.registros[i] = {
          ...this.registros[i],
          submissao_id: null,
          process_status: 'pendente',
          is_locked: false,
          updated_at: new Date().toISOString(),
        };
      }
    }
  }

  // Adiciona novo registro avulso ou em lote
  addRegistro(data: {
    nome: string;
    cpf_cnpj: string;
    tipo_documento?: 'cpf' | 'cnpj';
    telefone_whatsapp?: string;
    lote_id?: string;
    origem?: 'manual' | 'planilha';
  }): Registro {
    if (!data.nome || !data.cpf_cnpj) {
      throw new Error('Nome e documento (CPF/CNPJ) são obrigatórios.');
    }

    const clean = data.cpf_cnpj.replace(/\D/g, '');
    const isCnpj = clean.length > 11;
    const tipo = data.tipo_documento || (isCnpj ? 'cnpj' : 'cpf');
    const loteId = data.lote_id || 'lote-124';
    const now = new Date().toISOString();
    const id = `reg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const initials = data.nome
      .split(' ')
      .map((w) => w[0])
      .slice(0, 3)
      .join('')
      .toUpperCase();

    const novo: Registro = {
      id,
      tenant_id: ABDCM_TENANT_ID,
      lote_id: loteId,
      parceiro_id: 'parc-001',
      associado_id: `assoc-${id}`,
      nome: data.nome.trim(),
      cpf_cnpj_raw: clean,
      cpf_cnpj: data.cpf_cnpj.trim(),
      tipo_documento: tipo,
      process_status: 'pendente',
      is_locked: false,
      unit_price: 25000,
      is_bonus: false,
      protocol_code: `ABDCM-AC124-${this.registros.length + 1}-${initials}`,
      origem: data.origem || 'manual',
      created_at: now,
      updated_at: now,
    };

    this.registros.unshift(novo);
    return novo;
  }

  // Exclui registro pendente
  deleteRegistro(registroId: string): void {
    const idx = this.registros.findIndex((r) => r.id === registroId);
    if (idx === -1) {
      throw new Error('Registro não localizado.');
    }
    const reg = this.registros[idx];
    if (reg.is_locked || reg.process_status !== 'pendente') {
      throw new Error('Registros já enviados ou bloqueados não podem ser removidos.');
    }
    this.registros.splice(idx, 1);
  }

  // Executa transição com validação rigorosa (I1, I2)
  transitionStatus(
    registroId: string,
    paraStatus: ProcessStatus,
    motivo: string,
    atorUserId: string,
    atorTipo: 'parceiro' | 'admin' | 'system' | 'integracao',
    metadata?: Record<string, unknown>
  ): { registro: Registro; event: ProcessEvent } {
    const regIndex = this.registros.findIndex((r) => r.id === registroId);
    if (regIndex === -1) {
      throw new Error(`Registro "${registroId}" não encontrado.`);
    }
    const current = this.registros[regIndex];

    const { novoStatus, processEvent } = transitionProcessStatus({
      registroId: current.id,
      tenantId: current.tenant_id,
      deStatus: current.process_status,
      paraStatus,
      atorTipo,
      atorUserId,
      motivo,
      metadata,
    });

    const updated: Registro = {
      ...current,
      process_status: novoStatus,
      updated_at: new Date().toISOString(),
    };

    if (novoStatus === 'pago') {
      updated.is_locked = true;
    }
    if (novoStatus === 'protocolado') {
      updated.protocolado_em = new Date().toISOString();
    }
    if (novoStatus === 'baixado') {
      updated.baixado_em = new Date().toISOString();
    }

    this.registros[regIndex] = updated;
    this.processEvents.unshift(processEvent);

    // Registra na auditoria
    this.auditLogs.unshift({
      id: `audit_${Date.now()}`,
      tenant_id: current.tenant_id,
      ator_user_id: atorUserId,
      acao: 'TRANSICAO_STATUS',
      entidade_tipo: 'registros',
      entidade_id: current.id,
      antes: { process_status: current.process_status },
      depois: { process_status: novoStatus, motivo },
      ip: '127.0.0.1',
      user_agent: 'ABDCM-Server/1.0',
      ocorrido_em: new Date().toISOString(),
    });

    return { registro: updated, event: processEvent };
  }

  // I6: Revelação sob clique com auditoria
  revealDocument(registroId: string, userId: string): string {
    const reg = this.registros.find((r) => r.id === registroId);
    if (!reg) {
      throw new Error('Registro não localizado.');
    }

    this.auditLogs.unshift({
      id: `audit_${Date.now()}`,
      tenant_id: reg.tenant_id,
      ator_user_id: userId,
      acao: 'REVELACAO_DOCUMENTO_LGPD',
      entidade_tipo: 'registros',
      entidade_id: reg.id,
      ip: '127.0.0.1',
      user_agent: 'ABDCM-Admin-Console',
      ocorrido_em: new Date().toISOString(),
    });

    return reg.cpf_cnpj_raw;
  }
}

export const serverStore = new ServerStore();
