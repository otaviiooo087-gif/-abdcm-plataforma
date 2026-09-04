import { config } from 'dotenv'
import { randomBytes, randomUUID, scryptSync } from 'node:crypto'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { SENHA_DEMO } from '../lib/demo'
import * as s from './schema'
import { opcoesDeConexao } from './ssl'

/**
 * Semeia o banco com os mesmos dados fictícios de demonstração que a Fase 0
 * usava em memória. Roda uma vez, contra um banco vazio (as migrations já
 * aplicadas) — não é idempotente por design: rodar duas vezes duplica os
 * dados, porque não há chave natural de deduplicação nos nomes fictícios.
 */

function hashSenha(senha: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(senha, salt, 64).toString('hex')}`
}

const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const DIA = 86_400_000
const HORA = 3_600_000

const NOMES = [
  'Ana Paula Ribeiro', 'Bruno Camargo Lima', 'Carla Menezes Dias', 'Diego Fontes Alves',
  'Eduarda Nunes Prado', 'Fábio Rocha Teixeira', 'Gabriela Souza Martins', 'Henrique Barros Melo',
  'Isabela Cardoso Pinto', 'João Vitor Andrade', 'Karina Lopes Freitas', 'Lucas Moreira Antunes',
  'Mariana Castro Silva', 'Nelson Ferraz Duarte', 'Olívia Tavares Guedes', 'Paulo Ricardo Bastos',
  'Queila dos Santos Mota', 'Rafael Assunção Vieira', 'Simone Batista Correia', 'Thiago Nogueira Peixoto',
]

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

async function main() {
  config({ path: '.env.local' })
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL ausente. Copie .env.example para .env.local e preencha.')

  const sql = postgres({ ...opcoesDeConexao(url), max: 1 })
  const db = drizzle(sql, { schema: s })
  const agora = Date.now()

  try {
    console.log('semeando tenant ABDCM...')
    await db.insert(s.tenants).values({ id: TENANT_ID, nome: 'ABDCM', slug: 'abdcm', config: { precoPadraoTenant: 5490 } })

    const senha = hashSenha(SENHA_DEMO)
    const parceiroIds = { p1: randomUUID(), p2: randomUUID(), p3: randomUUID() }
    const userIds = {
      p1: randomUUID(), p2: randomUUID(), p3: randomUUID(),
      conciliador: randomUUID(), operador: randomUUID(), suporte: randomUUID(),
      financeiro: randomUUID(), admin: randomUUID(),
    }

    console.log('semeando usuários e parceiros...')
    await db.insert(s.users).values([
      { id: userIds.p1, tenantId: TENANT_ID, email: 'parceiro@abdcm.org.br', passwordHash: senha, role: 'parceiro', nome: 'Matheus Duarte' },
      { id: userIds.p2, tenantId: TENANT_ID, email: 'parceiro2@abdcm.org.br', passwordHash: senha, role: 'parceiro', nome: 'Renata Pimentel' },
      { id: userIds.p3, tenantId: TENANT_ID, email: 'parceiro3@abdcm.org.br', passwordHash: senha, role: 'parceiro', nome: 'Carlos Braga' },
      { id: userIds.conciliador, tenantId: TENANT_ID, email: 'conciliador@abdcm.org.br', passwordHash: senha, role: 'conciliador', nome: 'Juliana Prado' },
      { id: userIds.operador, tenantId: TENANT_ID, email: 'operador@abdcm.org.br', passwordHash: senha, role: 'operador', nome: 'Rodrigo Sanches' },
      { id: userIds.suporte, tenantId: TENANT_ID, email: 'suporte@abdcm.org.br', passwordHash: senha, role: 'suporte', nome: 'Priscila Gomes' },
      { id: userIds.financeiro, tenantId: TENANT_ID, email: 'financeiro@abdcm.org.br', passwordHash: senha, role: 'financeiro', nome: 'André Kawamoto' },
      { id: userIds.admin, tenantId: TENANT_ID, email: 'admin@abdcm.org.br', passwordHash: senha, role: 'administrador', nome: 'Beatriz Lemos' },
    ])

    await db.insert(s.parceiros).values([
      { id: parceiroIds.p1, tenantId: TENANT_ID, userId: userIds.p1, nomeCompleto: 'Matheus Ferreira Duarte', nomeExibicao: 'Matheus Duarte', cpfCnpj: cpfValido(318452901), whatsapp: '11987650001', cidade: 'São Paulo', uf: 'SP', partnerCode: 'ABD-0142', precoPorNome: 4990, totalNomesEnviados: 487 },
      { id: parceiroIds.p2, tenantId: TENANT_ID, userId: userIds.p2, nomeCompleto: 'Renata Alves Pimentel', nomeExibicao: 'Renata Pimentel', cpfCnpj: cpfValido(447120365), whatsapp: '21987650002', cidade: 'Rio de Janeiro', uf: 'RJ', partnerCode: 'ABD-0207', precoPorNome: null, totalNomesEnviados: 1123 },
      { id: parceiroIds.p3, tenantId: TENANT_ID, userId: userIds.p3, nomeCompleto: 'Carlos Eduardo Braga', nomeExibicao: 'Carlos Braga', cpfCnpj: cpfValido(690238114), whatsapp: '31987650003', cidade: 'Belo Horizonte', uf: 'MG', partnerCode: 'ABD-0311', precoPorNome: null, totalNomesEnviados: 96 },
    ])

    console.log('semeando lotes...')
    const loteIds = { l124: randomUUID(), l125: randomUUID() }
    await db.insert(s.lotes).values([
      { id: loteIds.l124, tenantId: TENANT_ID, nome: 'AÇÃO COLETIVA 124', numeroSequencial: 124, status: 'protocolado', abreEm: new Date(agora - 53 * DIA), closesAt: new Date(agora - 45 * DIA), precoPorNome: 5490, bureaus: ['Serasa', 'SPC', 'Boa Vista', 'Cenprot BR'], referenciaProtocolo: 'ESC-2026-0124' },
      { id: loteIds.l125, tenantId: TENANT_ID, nome: 'AÇÃO COLETIVA 125', numeroSequencial: 125, status: 'aberto', abreEm: new Date(agora - 3 * DIA), closesAt: new Date(agora + 4 * DIA + 7 * HORA), precoPorNome: 5490, bureaus: ['Serasa', 'SPC', 'Boa Vista', 'Cenprot BR', 'Cenprot SP'] },
    ])

    console.log('semeando associados...')
    const parceiroDe = (i: number) => (i < 8 ? parceiroIds.p1 : i < 13 ? parceiroIds.p2 : parceiroIds.p3)
    const associadoIds = NOMES.map(() => randomUUID())
    await db.insert(s.associados).values(
      NOMES.map((nome, i) => {
        const pendente = i === 6 || i === 11
        const ficha = i === 14
        const doc = cpfValido(120340000 + i * 7919)
        return {
          id: associadoIds[i]!,
          tenantId: TENANT_ID,
          parceiroId: parceiroDe(i),
          nome,
          cpfCnpj: doc,
          cpfCnpjRaw: doc,
          tipoDocumento: 'cpf' as const,
          telefoneWhatsapp: `1198${String(700000 + i * 37).slice(0, 6)}`,
          email: `${nome.split(' ')[0]!.toLowerCase()}@exemplo.com.br`,
          statusFiliacao: pendente ? 'pre_cadastro' as const : ficha ? 'ficha_enviada' as const : 'ativo' as const,
          filiadoEm: pendente || ficha ? null : new Date(agora - (30 + i) * DIA),
          consentimentoEm: pendente || ficha ? null : new Date(agora - (30 + i) * DIA),
          consentimentoIp: pendente || ficha ? null : `189.45.${i}.${20 + i}`,
          consentimentoHash: pendente || ficha ? null : `sha256:${(i * 991).toString(16).padStart(8, '0')}f3a1c${i}`,
        }
      }),
    )

    console.log('semeando submissões, registros e eventos do lote 124...')
    const registrosParaInserir: (typeof s.registros.$inferInsert)[] = []
    const eventosParaInserir: (typeof s.processEvents.$inferInsert)[] = []

    // Mesma tabela de transições do domínio (src/domain/registros/state-machine.ts),
    // só para rotular os eventos de semente com a transição correta.
    const TRANSICAO_POR_PAR: Record<string, string> = {
      'pendente>enviado': 'enviar_lista',
      'enviado>pago': 'webhook_pix_confirmado',
      'enviado>aguardando_pagamento': 'comprovante_manual_anexado',
      'aguardando_pagamento>pago': 'aprovado',
      'aguardando_pagamento>reprovado': 'rejeitado',
      'reprovado>aguardando_pagamento': 'novo_comprovante',
      'pago>aguardando_protocolo': 'automatico',
      'aguardando_protocolo>protocolado': 'protocolo_registrado',
      'protocolado>baixado': 'retorno_baixado',
      'protocolado>recusado': 'retorno_recusado',
    }

    function empurrarEvento(registroId: string, de: string, para: string, atorTipo: 'parceiro' | 'admin' | 'system' | 'integracao', quando: Date, extra: { reasonCode?: string; motivo?: string } = {}) {
      eventosParaInserir.push({
        tenantId: TENANT_ID, registroId,
        deStatus: de as (typeof s.processStatusEnum.enumValues)[number],
        paraStatus: para as (typeof s.processStatusEnum.enumValues)[number],
        atorTipo, transicao: TRANSICAO_POR_PAR[`${de}>${para}`] ?? 'excecao_admin',
        reasonCode: extra.reasonCode ?? null, motivo: extra.motivo ?? null, ocorridoEm: quando,
      })
    }

    for (let i = 0; i < 8; i++) {
      const status = i < 6 ? 'baixado' : i === 6 ? 'recusado' : 'protocolado'
      const id = randomUUID()
      const t0 = agora - 48 * DIA
      const preco = i < 6 ? 4990 : 5490
      registrosParaInserir.push({
        id, tenantId: TENANT_ID, loteId: loteIds.l124, parceiroId: i < 6 ? parceiroIds.p1 : parceiroIds.p2,
        associadoId: associadoIds[i]!, nome: NOMES[i]!, cpfCnpj: cpfValido(120340000 + i * 7919), cpfCnpjRaw: cpfValido(120340000 + i * 7919),
        tipoDocumento: 'cpf', processStatus: status, isLocked: true, unitPrice: preco, origem: 'manual',
        protocolCode: `AC124-${String(i + 1).padStart(4, '0')}`, enviadoEm: new Date(t0),
        protocoladoEm: new Date(agora - 40 * DIA), baixadoEm: status === 'baixado' ? new Date(agora - 3 * DIA) : null,
      })
      const passos: [string, string, string][] = [
        ['pendente', 'enviado', 'parceiro'], ['enviado', 'pago', 'integracao'],
        ['pago', 'aguardando_protocolo', 'system'], ['aguardando_protocolo', 'protocolado', 'system'],
      ]
      passos.forEach(([de, para, ator], k) => empurrarEvento(id, de, para, ator as 'parceiro', new Date(t0 + (k + 1) * HORA)))
      if (status === 'baixado') empurrarEvento(id, 'protocolado', 'baixado', 'integracao', new Date(agora - 3 * DIA), { motivo: 'Arquivo de retorno retorno_serasa_ac124.csv' })
      if (status === 'recusado') empurrarEvento(id, 'protocolado', 'recusado', 'integracao', new Date(agora - 3 * DIA), { reasonCode: 'divergencia_cadastral', motivo: 'Birô: dados cadastrais divergentes' })
    }

    console.log('semeando lote 125 (vigente)...')
    const subIds = { s1: randomUUID(), s2: randomUUID(), s3: randomUUID() }
    const submissoesParaInserir: (typeof s.submissoes.$inferInsert)[] = [
      { id: subIds.s1, tenantId: TENANT_ID, parceiroId: parceiroIds.p1, loteId: loteIds.l125, nomesCount: 4, valorTotal: 4 * 4990, paymentStatus: 'pago', submetidoEm: new Date(agora - 2 * DIA), confirmadoEm: new Date(agora - 2 * DIA + HORA) },
      { id: subIds.s2, tenantId: TENANT_ID, parceiroId: parceiroIds.p2, loteId: loteIds.l125, nomesCount: 3, valorTotal: 3 * 5490, paymentStatus: 'pendente', submetidoEm: new Date(agora - 5 * HORA), motivoExcecao: 'valor_divergente', valorIdentificado: 12000, comprovanteManual: true },
      { id: subIds.s3, tenantId: TENANT_ID, parceiroId: parceiroIds.p3, loteId: loteIds.l125, nomesCount: 2, valorTotal: 2 * 5490, paymentStatus: 'pendente', submetidoEm: new Date(agora - 51 * HORA), motivoExcecao: 'sem_webhook_48h' },
    ]

    type StatusRegistro = (typeof s.processStatusEnum.enumValues)[number]
    type OrigemRegistro = (typeof s.origemRegistroEnum.enumValues)[number]

    function criarRegistro125(idx: number, status: StatusRegistro, submissaoId: string | null, dias: number | null, extra: { bonus?: boolean; origem?: OrigemRegistro } = {}) {
      const id = randomUUID()
      const t0 = dias != null ? agora - dias * DIA : null
      const parceiroId = parceiroDe(idx)
      const doc = cpfValido(120340000 + idx * 7919)
      registrosParaInserir.push({
        id, tenantId: TENANT_ID, loteId: loteIds.l125, parceiroId, associadoId: associadoIds[idx]!, submissaoId,
        nome: NOMES[idx]!, cpfCnpj: doc, cpfCnpjRaw: doc, tipoDocumento: 'cpf', processStatus: status,
        isLocked: status !== 'pendente', unitPrice: extra.bonus ? 0 : (parceiroId === parceiroIds.p1 ? 4990 : 5490),
        isBonus: !!extra.bonus, origem: extra.origem ?? 'manual', enviadoEm: t0 ? new Date(t0) : null,
      })
      if (status !== 'pendente' && t0) {
        empurrarEvento(id, 'pendente', 'enviado', 'parceiro', new Date(t0))
        if (status === 'aguardando_pagamento') empurrarEvento(id, 'enviado', 'aguardando_pagamento', 'parceiro', new Date(t0 + 2 * HORA), { motivo: 'Comprovante manual anexado pelo parceiro' })
        if (status === 'aguardando_protocolo') {
          empurrarEvento(id, 'enviado', 'pago', 'integracao', new Date(t0 + HORA))
          empurrarEvento(id, 'pago', 'aguardando_protocolo', 'system', new Date(t0 + HORA + 60_000))
        }
      }
      return id
    }

    ;[0, 1, 2, 3].forEach((i) => criarRegistro125(i, 'aguardando_protocolo', subIds.s1, 2))
    ;[8, 9, 10].forEach((i) => criarRegistro125(i, 'aguardando_pagamento', subIds.s2, 1))
    ;[13, 14].forEach((i) => criarRegistro125(i, 'enviado', subIds.s3, 2))
    criarRegistro125(4, 'pendente', null, null)
    criarRegistro125(5, 'pendente', null, null, { origem: 'planilha' })
    criarRegistro125(6, 'pendente', null, null)
    criarRegistro125(11, 'pendente', null, null, { origem: 'planilha' })
    criarRegistro125(12, 'pendente', null, null, { bonus: true, origem: 'bonus' })

    await db.insert(s.submissoes).values(submissoesParaInserir)
    await db.insert(s.registros).values(registrosParaInserir)
    await db.insert(s.processEvents).values(eventosParaInserir)

    console.log('semeando cobranças PIX e contestações...')
    await db.insert(s.pixCobrancas).values([
      { tenantId: TENANT_ID, submissaoId: subIds.s1, provider: 'mock', txid: 'MOCK-TX-0001', valor: 4 * 4990, copiaECola: '00020126...MOCK0001', expiraEm: new Date(agora - 2 * DIA + HORA), status: 'pago', pagoEm: new Date(agora - 2 * DIA + HORA) },
      { tenantId: TENANT_ID, submissaoId: subIds.s3, provider: 'mock', txid: 'MOCK-TX-0003', valor: 2 * 5490, copiaECola: '00020126...MOCK0003', expiraEm: new Date(agora - 50 * HORA), status: 'expirado' },
    ])

    const registrosLote124 = registrosParaInserir.filter((r) => r.loteId === loteIds.l124)
    await db.insert(s.contestacoes).values([
      { tenantId: TENANT_ID, parceiroId: parceiroIds.p1, loteId: loteIds.l124, registroId: registrosLote124[6]!.id!, reasonCode: 'lista_concluiu_nome_nao_baixou', descricao: 'Lista concluiu e o nome não baixou.', status: 'aberta', abertaEm: new Date(agora - 41 * HORA), slaVenceEm: new Date(agora + 7 * HORA) },
      { tenantId: TENANT_ID, parceiroId: parceiroIds.p2, loteId: loteIds.l124, registroId: registrosLote124[7]!.id!, reasonCode: 'lista_concluiu_nome_nao_baixou', descricao: 'Lista concluiu e o nome não baixou.', status: 'aberta', abertaEm: new Date(agora - 55 * HORA), slaVenceEm: new Date(agora - 7 * HORA) },
    ])

    console.log(`\npronto. senha de demonstração: ${SENHA_DEMO}`)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
