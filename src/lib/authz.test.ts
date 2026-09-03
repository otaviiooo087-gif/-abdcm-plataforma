import { describe, expect, it } from 'vitest'
import { pode, ROLES, exigir, SemPermissaoError, type Role } from './authz'

describe('separação de funções', () => {
  const proibicoes: Array<[Role, string, string]> = [
    ['conciliador', 'preco.alterar', 'quem concilia pagamento não altera preço'],
    ['conciliador', 'financeiro.ledger', 'conciliador não vê o ledger completo'],
    ['conciliador', 'documento.revelar_cpf', 'conciliador não revela CPF'],
    ['operador', 'conciliacao.aprovar', 'quem opera lote não aprova pagamento'],
    ['operador', 'preco.alterar', 'operador não altera preço'],
    ['operador', 'usuarios.gerenciar', 'operador não gerencia usuários'],
    ['suporte', 'registro.status.alterar', 'quem atende cliente não muda status'],
    ['suporte', 'financeiro.ajustar', 'suporte não faz escrita financeira'],
    ['financeiro', 'registro.status.alterar', 'financeiro não muda status de processo'],
    ['financeiro', 'lote.encerrar', 'financeiro não encerra lote'],
    ['parceiro', 'admin.acessar', 'parceiro não acessa o console administrativo'],
  ]

  it.each(proibicoes)('%s NÃO pode %s (%s)', (role, permissao) => {
    expect(pode(role, permissao as never)).toBe(false)
    expect(() => exigir(role, permissao as never)).toThrow(SemPermissaoError)
  })

  it('administrador pode tudo', () => {
    expect(pode('administrador', 'usuarios.gerenciar')).toBe(true)
    expect(pode('administrador', 'lgpd.console')).toBe(true)
  })

  it('somente o parceiro acessa o portal do parceiro', () => {
    for (const r of ROLES) {
      expect(pode(r, 'portal.parceiro')).toBe(r === 'parceiro')
    }
  })
})
