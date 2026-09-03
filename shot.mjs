import { chromium } from 'playwright'
const OUT = process.argv[2]
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
let p = await ctx.newPage()
const login = async (email) => {
  await ctx.clearCookies()
  await p.goto('http://localhost:3100/login')
  await p.fill('#email', email); await p.fill('#senha', 'abdcm2026')
  await p.click('button[type=submit]'); await p.waitForLoadState('networkidle')
}
const shot = async (nome) => { await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/${nome}.png`, fullPage: true }) }

await p.goto('http://localhost:3100/login'); await shot('01-login')
await login('conciliador@abdcm.org.br'); await shot('02-painel-conciliador')
await p.goto('http://localhost:3100/admin/conciliacao'); await p.waitForLoadState('networkidle')
await p.click('button:has-text("Reprovar")'); await shot('03-conciliacao-reason-code')
await p.goto('http://localhost:3100/admin/auditoria'); await shot('04-acesso-negado')
await login('admin@abdcm.org.br')
await p.goto('http://localhost:3100/admin/registros'); await shot('05-cpf-mascarado')
await p.click('table tbody tr:first-child a'); await p.waitForLoadState('networkidle')
await p.click('button:has-text("revelar")'); await p.waitForTimeout(800); await shot('06-timeline-revelacao')
await p.goto('http://localhost:3100/admin/auditoria'); await shot('07-auditoria')
await p.goto('http://localhost:3100/admin/lote'); await shot('08-encerramento-gates')
await login('parceiro@abdcm.org.br'); await p.waitForTimeout(1200); await shot('09-portal-parceiro')
await p.goto('http://localhost:3100/app/envio'); await shot('10-envio-lista')
await p.goto('http://localhost:3100/consulta')
await p.fill('#protocolo', 'AC124-0001'); await p.click('button:has-text("Consultar")')
await p.waitForTimeout(1200); await shot('11-consulta-publica')
await b.close()
console.log('telas geradas')
