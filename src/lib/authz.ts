/**
 * Autorização por papel — declarada em um só lugar e aplicada no servidor (I1).
 * Separação de funções: quem concilia pagamento não altera preço; quem atende
 * cliente não muda status; quem opera lote não aprova pagamento.
 */

export const ROLES = [
  'parceiro',
  'conciliador',
  'operador',
  'suporte',
  'financeiro',
  'administrador',
] as const

export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  parceiro: 'Parceiro',
  conciliador: 'Conciliador',
  operador: 'Operador',
  suporte: 'Suporte',
  financeiro: 'Financeiro',
  administrador: 'Administrador',
}

export const PERMISSOES = [
  'portal.parceiro',
  'admin.acessar',
  'conciliacao.ver',
  'conciliacao.aprovar',
  'conciliacao.reprovar',
  'lote.ver',
  'lote.editar',
  'lote.encerrar',
  'protocolo.registrar',
  'retorno.importar',
  'registro.ver',
  'registro.status.alterar',
  'documento.revelar_cpf',
  'contestacao.ver',
  'contestacao.responder',
  'financeiro.ledger',
  'financeiro.ajustar',
  'preco.alterar',
  'parceiro.impersonar',
  'usuarios.gerenciar',
  'auditoria.ver',
  'lgpd.console',
] as const

export type Permissao = (typeof PERMISSOES)[number]

const MATRIZ: Record<Role, Permissao[]> = {
  parceiro: ['portal.parceiro'],

  // Faz a fila de conciliação. Não vê ledger completo, não mexe em preço,
  // não revela CPF.
  conciliador: [
    'admin.acessar',
    'conciliacao.ver',
    'conciliacao.aprovar',
    'conciliacao.reprovar',
    'registro.ver',
    'lote.ver',
  ],

  // Opera lotes, encerramento, protocolo e baixa em massa.
  // Não aprova pagamento, não mexe em preço, não gerencia usuários.
  operador: [
    'admin.acessar',
    'lote.ver',
    'lote.editar',
    'lote.encerrar',
    'protocolo.registrar',
    'retorno.importar',
    'registro.ver',
    'registro.status.alterar',
  ],

  // Atende cliente. Nenhuma escrita financeira ou de status.
  suporte: [
    'admin.acessar',
    'registro.ver',
    'lote.ver',
    'contestacao.ver',
    'contestacao.responder',
    'parceiro.impersonar',
  ],

  // Ledger, assinaturas, bônus, ajustes, relatórios.
  // Não muda status de processo, não encerra lote.
  financeiro: [
    'admin.acessar',
    'registro.ver',
    'lote.ver',
    'financeiro.ledger',
    'financeiro.ajustar',
    'preco.alterar',
  ],

  // Tudo, inclusive configuração e usuários. O acesso ao portal do parceiro
  // não é herdado: passa por impersonação rastreada ("Ver como parceiro"),
  // com banner permanente, sessão com prazo e registro em auditoria.
  administrador: PERMISSOES.filter((p) => p !== 'portal.parceiro'),
}

export function permissoesDe(role: Role): readonly Permissao[] {
  return MATRIZ[role]
}

export function pode(role: Role, permissao: Permissao): boolean {
  return MATRIZ[role].includes(permissao)
}

export class SemPermissaoError extends Error {
  constructor(readonly role: Role, readonly permissao: Permissao) {
    super(`O papel "${role}" não tem a permissão "${permissao}".`)
    this.name = 'SemPermissaoError'
  }
}

/** Guarda de servidor. Toda rota administrativa passa por aqui. */
export function exigir(role: Role, permissao: Permissao): void {
  if (!pode(role, permissao)) throw new SemPermissaoError(role, permissao)
}
