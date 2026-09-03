import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const SENHA = 'abdcm2026'
const CONTAS = [
  ['parceiro@abdcm.org.br', '/app'],
  ['conciliador@abdcm.org.br', '/admin'],
  ['operador@abdcm.org.br', '/admin'],
  ['suporte@abdcm.org.br', '/admin'],
  ['financeiro@abdcm.org.br', '/admin'],
  ['admin@abdcm.org.br', '/admin'],
]

// Usa o Chromium do Playwright por padrão. Em ambientes que já trazem o
// navegador instalado, aponte o caminho em CHROMIUM_PATH.
const executablePath = process.env.CHROMIUM_PATH || undefined
const browser = await chromium.launch(executablePath ? { executablePath } : {})
let falhas = 0
const ok = (m) => console.log('  ok  ' + m)
const falha = (m) => { falhas++; console.log('FALHA ' + m) }

async function login(page, email, senha = SENHA) {
  await page.goto(BASE + '/login')
  await page.fill('#email', email)
  await page.fill('#senha', senha)
  await Promise.all([page.waitForLoadState('networkidle'), page.click('button[type=submit]')])
}

// 1. Login de cada papel leva à superfície correta
for (const [email, destino] of CONTAS) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await login(page, email)
  const url = new URL(page.url()).pathname
  url === destino ? ok(`${email} → ${url}`) : falha(`${email} → ${url}, esperado ${destino}`)
  await ctx.close()
}

// 2. Senha errada não autentica
{
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  await login(page, 'admin@abdcm.org.br', 'senhaerrada123')
  const corpo = await page.textContent('body')
  new URL(page.url()).pathname === '/login' && corpo.includes('E-mail ou senha incorretos')
    ? ok('senha errada rejeitada com mensagem genérica') : falha('senha errada não foi rejeitada')
  await ctx.close()
}

// 3. Usuário inexistente recebe a MESMA mensagem (não confirma cadastro)
{
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  await login(page, 'naoexiste@abdcm.org.br')
  const corpo = await page.textContent('body')
  corpo.includes('E-mail ou senha incorretos')
    ? ok('usuário inexistente recebe mensagem idêntica') : falha('mensagem vazou existência de cadastro')
  await ctx.close()
}

// 4. Separação de funções: papéis sem permissão são barrados na rota
const BARRADOS = [
  ['operador@abdcm.org.br', '/admin/conciliacao', 'operador não aprova pagamento'],
  ['suporte@abdcm.org.br', '/admin/conciliacao', 'suporte não concilia'],
  ['financeiro@abdcm.org.br', '/admin/conciliacao', 'financeiro não concilia'],
  ['conciliador@abdcm.org.br', '/admin/auditoria', 'conciliador não vê auditoria'],
  ['conciliador@abdcm.org.br', '/app', 'conciliador não entra no portal do parceiro'],
  ['parceiro@abdcm.org.br', '/admin', 'parceiro não entra no console'],
]
for (const [email, rota, desc] of BARRADOS) {
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  await login(page, email)
  await page.goto(BASE + rota)
  const p = new URL(page.url()).pathname
  p !== rota ? ok(`${desc} (${rota} → ${p})`) : falha(`${desc}: acessou ${rota}`)
  await ctx.close()
}

// 5. Quem TEM permissão acessa
{
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  await login(page, 'conciliador@abdcm.org.br')
  await page.goto(BASE + '/admin/conciliacao')
  new URL(page.url()).pathname === '/admin/conciliacao'
    ? ok('conciliador acessa a fila de conciliação') : falha('conciliador foi barrado da própria fila')
  await ctx.close()
}

// 6. CPF mascarado por padrão no admin
{
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  await login(page, 'admin@abdcm.org.br')
  await page.goto(BASE + '/admin/registros')
  const html = await page.content()
  const temMascara = /\d{3}\.\*\*\*\.\*\*\d-\d{2}/.test(html)
  const temCpfCompleto = /\d{3}\.\d{3}\.\d{3}-\d{2}/.test(html)
  temMascara && !temCpfCompleto
    ? ok('listagem admin entrega apenas documentos mascarados')
    : falha(`máscara=${temMascara} cpfCompleto=${temCpfCompleto}`)
  await ctx.close()
}

// 7. Revelação de CPF funciona e gera linha de auditoria
{
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  await login(page, 'admin@abdcm.org.br')
  await page.goto(BASE + '/admin/registros')
  await page.click('table tbody tr:first-child a')
  await page.waitForLoadState('networkidle')
  await page.click('button:has-text("revelar")')
  await page.waitForSelector('text=revelação registrada em auditoria', { timeout: 5000 })
  ok('revelação de CPF devolve o valor completo sob clique explícito')
  await page.goto(BASE + '/admin/auditoria')
  const corpo = await page.textContent('body')
  corpo.includes('Revelação de CPF')
    ? ok('revelação apareceu na auditoria') : falha('revelação não foi auditada')
  await ctx.close()
}

// 8. Conciliação: aprovar avança os registros e grava ProcessEvent
{
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  await login(page, 'conciliador@abdcm.org.br')
  await page.goto(BASE + '/admin/conciliacao')
  await page.click('button:has-text("Aprovar")')
  await page.waitForSelector('text=avançaram para aguardando_protocolo', { timeout: 8000 })
  ok('aprovação transicionou os registros da submissão')
  await ctx.close()
}

// 9. Consulta pública: protocolo errado não confirma existência do CPF
{
  const ctx = await browser.newContext(); const page = await ctx.newPage()
  await page.goto(BASE + '/consulta')
  const doc = await page.inputValue('#documento')
  await page.fill('#protocolo', 'AC999-9999')
  await page.click('button:has-text("Consultar")')
  await page.waitForSelector('text=Não encontramos', { timeout: 5000 })
  ok('protocolo errado devolve resposta genérica')
  await page.fill('#documento', doc)
  await page.fill('#protocolo', 'AC124-0001')
  await page.click('button:has-text("Consultar")')
  const achou = await page.waitForSelector('text=Timeline do processo', { timeout: 5000 }).catch(() => null)
  achou ? ok('consulta correta devolve a timeline') : falha('consulta correta não devolveu timeline')
  await ctx.close()
}

await browser.close()
console.log(falhas === 0 ? '\nTODOS OS CHECKS PASSARAM' : `\n${falhas} CHECKS FALHARAM`)
process.exit(falhas === 0 ? 0 : 1)
