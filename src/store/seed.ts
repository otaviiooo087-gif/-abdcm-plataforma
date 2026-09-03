import type { ProcessEvent, ProcessStatus } from '@/domain/registros/state-machine'
import type {
  Associado,
  Banco,
  Contestacao,
  Lote,
  Parceiro,
  PixCobranca,
  Registro,
  Submissao,
  User,
} from './schema'

/**
 * Dados de demonstração da Fase 0.
 *
 * A senha de demonstração vem de DEMO_PASSWORD (padrão "abdcm2026"). Não é
 * credencial de nenhum sistema real — é semente local, e o hash é gerado em
 * tempo de execução, nunca versionado (invariante I10).
 */
export const SENHA_DEMO = process.env.DEMO_PASSWORD ?? 'abdcm2026'

const TENANT = 'tenant-abdcm'
const hora = 3_600_000
const dia = 24 * hora

const NOMES = [
  'Ana Paula Ribeiro', 'Bruno Camargo Lima', 'Carla Menezes Dias', 'Diego Fontes Alves',
  'Eduarda Nunes Prado', 'Fábio Rocha Teixeira', 'Gabriela Souza Martins', 'Henrique Barros Melo',
  'Isabela Cardoso Pinto', 'João Vitor Andrade', 'Karina Lopes Freitas', 'Lucas Moreira Antunes',
  'Mariana Castro Silva', 'Nelson Ferraz Duarte', 'Olívia Tavares Guedes', 'Paulo Ricardo Bastos',
  'Queila dos Santos Mota', 'Rafael Assunção Vieira', 'Simone Batista Correia', 'Thiago Nogueira Peixoto',
  'Ursula Amaral Coelho', 'Vinícius Padilha Rocha', 'Wanessa Brito Sales', 'Yuri Cavalcanti Reis',
]

/** Gera CPF com dígito verificador válido a partir de uma base de 9 dígitos. */
function cpfValido(base: number): string {
  const d = String(base).padStart(9, '0').slice(0, 9).split('').map(Number)
  const dig = (arr: number[], peso: number) => {
    const soma = arr.reduce((acc, n, i) => acc + n * (peso - i), 0)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  const d1 = dig(d, 10)
  const d2 = dig([...d, d1], 11)
  return [...d, d1, d2].join('')
}

export function seed(hash: (s: string) => string): Banco {
  const agora = Date.now()
  const senha = hash(SENHA_DEMO)

  const parceiros: Parceiro[] = [
    {
      id: 'parc-1', tenantId: TENANT, userId: 'user-parceiro', nomeCompleto: 'Matheus Ferreira Duarte',
      nomeExibicao: 'Matheus Duarte', cpfCnpj: cpfValido(318452901), whatsapp: '11987650001',
      cidade: 'São Paulo', uf: 'SP', partnerCode: 'ABD-0142', precoPorNome: 4990,
      totalNomesEnviados: 487, isActive: true,
    },
    {
      id: 'parc-2', tenantId: TENANT, userId: 'user-parceiro-2', nomeCompleto: 'Renata Alves Pimentel',
      nomeExibicao: 'Renata Pimentel', cpfCnpj: cpfValido(447120365), whatsapp: '21987650002',
      cidade: 'Rio de Janeiro', uf: 'RJ', partnerCode: 'ABD-0207', precoPorNome: null,
      totalNomesEnviados: 1123, isActive: true,
    },
    {
      id: 'parc-3', tenantId: TENANT, userId: 'user-parceiro-3', nomeCompleto: 'Carlos Eduardo Braga',
      nomeExibicao: 'Carlos Braga', cpfCnpj: cpfValido(690238114), whatsapp: '31987650003',
      cidade: 'Belo Horizonte', uf: 'MG', partnerCode: 'ABD-0311', precoPorNome: null,
      totalNomesEnviados: 96, isActive: true,
    },
  ]

  const users: User[] = [
    { id: 'user-parceiro', tenantId: TENANT, email: 'parceiro@abdcm.org.br', passwordHash: senha, role: 'parceiro', nome: 'Matheus Duarte', isActive: true, parceiroId: 'parc-1' },
    { id: 'user-parceiro-2', tenantId: TENANT, email: 'parceiro2@abdcm.org.br', passwordHash: senha, role: 'parceiro', nome: 'Renata Pimentel', isActive: true, parceiroId: 'parc-2' },
    { id: 'user-parceiro-3', tenantId: TENANT, email: 'parceiro3@abdcm.org.br', passwordHash: senha, role: 'parceiro', nome: 'Carlos Braga', isActive: true, parceiroId: 'parc-3' },
    { id: 'user-conciliador', tenantId: TENANT, email: 'conciliador@abdcm.org.br', passwordHash: senha, role: 'conciliador', nome: 'Juliana Prado', isActive: true, parceiroId: null },
    { id: 'user-operador', tenantId: TENANT, email: 'operador@abdcm.org.br', passwordHash: senha, role: 'operador', nome: 'Rodrigo Sanches', isActive: true, parceiroId: null },
    { id: 'user-suporte', tenantId: TENANT, email: 'suporte@abdcm.org.br', passwordHash: senha, role: 'suporte', nome: 'Priscila Gomes', isActive: true, parceiroId: null },
    { id: 'user-financeiro', tenantId: TENANT, email: 'financeiro@abdcm.org.br', passwordHash: senha, role: 'financeiro', nome: 'André Kawamoto', isActive: true, parceiroId: null },
    { id: 'user-admin', tenantId: TENANT, email: 'admin@abdcm.org.br', passwordHash: senha, role: 'administrador', nome: 'Beatriz Lemos', isActive: true, parceiroId: null },
  ]

  const lotes: Lote[] = [
    {
      id: 'lote-123', tenantId: TENANT, nome: 'AÇÃO COLETIVA 123', numeroSequencial: 123,
      status: 'concluido', abreEm: new Date(agora - 62 * dia), closesAt: new Date(agora - 54 * dia),
      precoPorNome: 5490, bureaus: ['Serasa', 'SPC', 'Boa Vista'],
      referenciaProtocolo: 'ESC-2026-0123', concluidoEm: new Date(agora - 2 * dia),
    },
    {
      id: 'lote-124', tenantId: TENANT, nome: 'AÇÃO COLETIVA 124', numeroSequencial: 124,
      status: 'protocolado', abreEm: new Date(agora - 53 * dia), closesAt: new Date(agora - 45 * dia),
      precoPorNome: 5490, bureaus: ['Serasa', 'SPC', 'Boa Vista', 'Cenprot BR'],
      referenciaProtocolo: 'ESC-2026-0124', concluidoEm: null,
    },
    {
      id: 'lote-125', tenantId: TENANT, nome: 'AÇÃO COLETIVA 125', numeroSequencial: 125,
      status: 'aberto', abreEm: new Date(agora - 3 * dia), closesAt: new Date(agora + 4 * dia + 7 * hora),
      precoPorNome: 5490, bureaus: ['Serasa', 'SPC', 'Boa Vista', 'Cenprot BR', 'Cenprot SP'],
      referenciaProtocolo: null, concluidoEm: null,
    },
  ]

  const associados: Associado[] = NOMES.map((nome, i) => {
    const parceiroId = i < 12 ? 'parc-1' : i < 20 ? 'parc-2' : 'parc-3'
    const pendente = i === 10 || i === 11 || i === 19
    return {
      id: `asso-${i + 1}`, tenantId: TENANT, parceiroId, nome,
      cpfCnpj: cpfValido(120340000 + i * 7919), tipoDocumento: 'cpf',
      telefoneWhatsapp: `1198${String(700000 + i * 37).slice(0, 6)}`,
      email: `${nome.split(' ')[0]!.toLowerCase()}@exemplo.com.br`,
      statusFiliacao: pendente ? (i === 19 ? 'ficha_enviada' : 'pre_cadastro') : 'ativo',
      filiadoEm: pendente ? null : new Date(agora - (30 + i) * dia),
      consentimentoEm: pendente ? null : new Date(agora - (30 + i) * dia),
      consentimentoIp: pendente ? null : `189.45.${i}.${20 + i}`,
      consentimentoHash: pendente ? null : `sha256:${(i * 991).toString(16).padStart(8, '0')}f3a1c${i}`,
    }
  })

  const registros: Registro[] = []
  const processEvents: ProcessEvent[] = []
  const submissoes: Submissao[] = []
  const pixCobrancas: PixCobranca[] = []

  const evento = (
    registroId: string, de: ProcessStatus, para: ProcessStatus,
    atorTipo: ProcessEvent['atorTipo'], quando: Date, extras: Partial<ProcessEvent> = {},
  ) => {
    processEvents.push({
      registroId, tenantId: TENANT, deStatus: de, paraStatus: para, atorTipo,
      atorUserId: extras.atorUserId ?? null, transicao: extras.transicao ?? 'enviar_lista',
      reasonCode: extras.reasonCode ?? null, motivo: extras.motivo ?? null,
      metadata: extras.metadata ?? {}, ocorridoEm: quando,
    })
  }

  /** Cria um registro já com a trilha de eventos coerente com o status atual. */
  function criar(cfg: {
    id: string; loteId: string; parceiroId: string; associadoIdx: number; status: ProcessStatus
    submissaoId?: string; unitPrice?: number; isBonus?: boolean; protocolCode?: string | null
    origem?: Registro['origem']; enviadoHaDias?: number
  }): Registro {
    const asso = associados[cfg.associadoIdx]!
    const enviadoEm = cfg.enviadoHaDias != null ? new Date(agora - cfg.enviadoHaDias * dia) : null
    const r: Registro = {
      id: cfg.id, tenantId: TENANT, loteId: cfg.loteId, parceiroId: cfg.parceiroId,
      associadoId: asso.id, submissaoId: cfg.submissaoId ?? null, nome: asso.nome,
      cpfCnpj: asso.cpfCnpj, processStatus: cfg.status,
      isLocked: cfg.status !== 'pendente' && cfg.status !== 'cancelado',
      unitPrice: cfg.isBonus ? 0 : (cfg.unitPrice ?? 5490), isBonus: cfg.isBonus ?? false,
      protocolCode: cfg.protocolCode ?? null, reprotocolOfRegistroId: null,
      origem: cfg.origem ?? 'manual', enviadoEm,
      protocoladoEm: ['protocolado', 'baixado', 'recusado'].includes(cfg.status)
        ? new Date(agora - 40 * dia) : null,
      baixadoEm: cfg.status === 'baixado' ? new Date(agora - 3 * dia) : null,
    }

    const t0 = enviadoEm ?? new Date(agora - dia)
    const ordem: ProcessStatus[] = ['pendente', 'enviado', 'pago', 'aguardando_protocolo', 'protocolado']
    const alvo = ordem.indexOf(cfg.status)
    if (alvo > 0) {
      for (let i = 1; i <= alvo; i++) {
        evento(r.id, ordem[i - 1]!, ordem[i]!, i === 1 ? 'parceiro' : i === 2 ? 'integracao' : 'system',
          new Date(t0.getTime() + i * hora),
          { transicao: (['enviar_lista', 'webhook_pix_confirmado', 'automatico', 'protocolo_registrado'] as const)[i - 1] })
      }
    }
    if (cfg.status === 'aguardando_pagamento') {
      evento(r.id, 'pendente', 'enviado', 'parceiro', t0, { transicao: 'enviar_lista' })
      evento(r.id, 'enviado', 'aguardando_pagamento', 'parceiro', new Date(t0.getTime() + 2 * hora),
        { transicao: 'comprovante_manual_anexado', motivo: 'comprovante manual anexado pelo parceiro' })
    }
    if (cfg.status === 'baixado') {
      for (const [i, par] of ([['pendente', 'enviado'], ['enviado', 'pago'], ['pago', 'aguardando_protocolo'],
        ['aguardando_protocolo', 'protocolado']] as const).entries()) {
        evento(r.id, par[0], par[1], i === 0 ? 'parceiro' : i === 1 ? 'integracao' : 'system',
          new Date(t0.getTime() + (i + 1) * hora))
      }
      evento(r.id, 'protocolado', 'baixado', 'integracao', new Date(agora - 3 * dia),
        { transicao: 'retorno_baixado', metadata: { arquivo: 'retorno_serasa_ac124.csv', birô: 'Serasa' } })
    }
    if (cfg.status === 'recusado') {
      evento(r.id, 'protocolado', 'recusado', 'integracao', new Date(agora - 3 * dia),
        { transicao: 'retorno_recusado', reasonCode: 'divergencia_cadastral',
          motivo: 'Birô: dados cadastrais divergentes' })
    }
    registros.push(r)
    return r
  }

  // ---- Lote 124 (protocolado, com retorno parcial já aplicado) --------------
  for (let i = 0; i < 10; i++) {
    criar({
      id: `reg-124-${i + 1}`, loteId: 'lote-124', parceiroId: i < 6 ? 'parc-1' : 'parc-2',
      associadoIdx: i, status: i < 7 ? 'baixado' : i === 7 ? 'recusado' : 'protocolado',
      protocolCode: `AC124-${String(i + 1).padStart(4, '0')}`, enviadoHaDias: 48,
      unitPrice: i < 6 ? 4990 : 5490,
    })
  }

  // ---- Lote 125 (vigente) --------------------------------------------------
  const sub1: Submissao = {
    id: 'sub-1', tenantId: TENANT, parceiroId: 'parc-1', loteId: 'lote-125', nomesCount: 4,
    valorTotal: 4 * 4990, paymentStatus: 'pago', submetidoEm: new Date(agora - 2 * dia),
    confirmadoEm: new Date(agora - 2 * dia + hora), reasonCode: null, motivoObservacao: null,
    motivoExcecao: null, valorIdentificado: 4 * 4990, comprovanteManual: false,
  }
  const sub2: Submissao = {
    id: 'sub-2', tenantId: TENANT, parceiroId: 'parc-2', loteId: 'lote-125', nomesCount: 3,
    valorTotal: 3 * 5490, paymentStatus: 'pendente', submetidoEm: new Date(agora - 5 * hora),
    confirmadoEm: null, reasonCode: null, motivoObservacao: null,
    motivoExcecao: 'valor_divergente', valorIdentificado: 12000, comprovanteManual: true,
  }
  const sub3: Submissao = {
    id: 'sub-3', tenantId: TENANT, parceiroId: 'parc-3', loteId: 'lote-125', nomesCount: 2,
    valorTotal: 2 * 5490, paymentStatus: 'pendente', submetidoEm: new Date(agora - 51 * hora),
    confirmadoEm: null, reasonCode: null, motivoObservacao: null,
    motivoExcecao: 'sem_webhook_48h', valorIdentificado: null, comprovanteManual: false,
  }
  submissoes.push(sub1, sub2, sub3)

  pixCobrancas.push(
    { id: 'pix-1', tenantId: TENANT, submissaoId: 'sub-1', provider: 'mock', txid: 'MOCK-TX-0001', valor: sub1.valorTotal, copiaECola: '00020126...MOCK0001', expiraEm: new Date(agora - 2 * dia + hora), status: 'pago', pagoEm: sub1.confirmadoEm },
    { id: 'pix-3', tenantId: TENANT, submissaoId: 'sub-3', provider: 'mock', txid: 'MOCK-TX-0003', valor: sub3.valorTotal, copiaECola: '00020126...MOCK0003', expiraEm: new Date(agora - 50 * hora), status: 'expirado', pagoEm: null },
  )

  // pagos e prontos
  for (let i = 0; i < 4; i++) {
    criar({ id: `reg-125-p${i + 1}`, loteId: 'lote-125', parceiroId: 'parc-1', associadoIdx: i,
      status: 'aguardando_protocolo', submissaoId: 'sub-1', unitPrice: 4990, enviadoHaDias: 2 })
  }
  // comprovante manual em análise (fila de conciliação)
  for (let i = 0; i < 3; i++) {
    criar({ id: `reg-125-a${i + 1}`, loteId: 'lote-125', parceiroId: 'parc-2', associadoIdx: 12 + i,
      status: 'aguardando_pagamento', submissaoId: 'sub-2', enviadoHaDias: 1 })
  }
  // enviados sem pagamento há 48h
  for (let i = 0; i < 2; i++) {
    criar({ id: `reg-125-e${i + 1}`, loteId: 'lote-125', parceiroId: 'parc-3', associadoIdx: 20 + i,
      status: 'enviado', submissaoId: 'sub-3', enviadoHaDias: 2 })
  }
  // pendentes (ainda não enviados) — inclui dois sem ficha assinada
  for (let i = 0; i < 4; i++) {
    criar({ id: `reg-125-n${i + 1}`, loteId: 'lote-125', parceiroId: 'parc-1',
      associadoIdx: 8 + i, status: 'pendente', unitPrice: 4990,
      origem: i === 3 ? 'planilha' : 'manual' })
  }
  // bônus por volume
  criar({ id: 'reg-125-b1', loteId: 'lote-125', parceiroId: 'parc-2', associadoIdx: 15,
    status: 'pendente', isBonus: true, origem: 'bonus' })

  const contestacoes: Contestacao[] = [
    { id: 'cont-1', tenantId: TENANT, parceiroId: 'parc-1', loteId: 'lote-123', registroId: 'reg-124-8',
      reasonCode: 'lista_concluiu_nome_nao_baixou', descricao: 'Lista concluiu e o nome não baixou.',
      status: 'aberta', abertaEm: new Date(agora - 41 * hora), slaVenceEm: new Date(agora + 7 * hora), resolvidoEm: null },
    { id: 'cont-2', tenantId: TENANT, parceiroId: 'parc-2', loteId: 'lote-123', registroId: 'reg-124-9',
      reasonCode: 'lista_concluiu_nome_nao_baixou', descricao: 'Lista concluiu e o nome não baixou.',
      status: 'aberta', abertaEm: new Date(agora - 55 * hora), slaVenceEm: new Date(agora - 7 * hora), resolvidoEm: null },
  ]

  return {
    tenantId: TENANT, precoPadraoTenant: 5490, users, parceiros, associados, lotes,
    registros, submissoes, pixCobrancas, processEvents, contestacoes, auditLog: [],
  }
}
