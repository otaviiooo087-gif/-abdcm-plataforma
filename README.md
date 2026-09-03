# ABDCM — Plataforma de Ação Coletiva

Fase 0 (fundação) da plataforma de gestão de ação coletiva da ABDCM, com persistência real em
Postgres. A especificação completa está em
[`docs/PROMPT-ABDCM-COMPLETO.md`](docs/PROMPT-ABDCM-COMPLETO.md); o resumo operacional, em
[`CLAUDE.md`](CLAUDE.md).

## Como rodar

Precisa de um Postgres — local (Docker ou instalação nativa) ou hospedado (Supabase, Vercel
Postgres). Qualquer um serve, é conexão Postgres padrão.

```bash
npm install
npm run setup                                  # gera .env.local com um SESSION_SECRET aleatório

# edite .env.local e preencha DATABASE_URL, então:
npm run db:migrate                             # cria as tabelas (só na primeira vez)
npm run db:seed                                # popula com dados fictícios de demonstração

npm run dev                                    # sobe em http://localhost:3000
```

Sem Postgres à mão? O caminho mais rápido é Docker:

```bash
docker run -d --name abdcm-db -e POSTGRES_PASSWORD=abdcm -e POSTGRES_DB=abdcm -p 5432:5432 postgres:16
# DATABASE_URL=postgresql://postgres:abdcm@localhost:5432/abdcm
```

Nenhuma integração externa além do banco é necessária: PIX, WhatsApp e assinatura eletrônica
ainda não têm provider real — os adaptadores existem, mas a Fase 1 é quem os implementa.

### Contas de demonstração

Senha de todas: `abdcm2026` (definível por `DEMO_PASSWORD` antes de rodar `npm run db:seed`; é
semente local, não credencial de sistema real — o hash é gerado em tempo de execução e nunca
versionado).

| E-mail | Papel | Onde entra |
|---|---|---|
| `parceiro@abdcm.org.br` | parceiro | portal do parceiro |
| `conciliador@abdcm.org.br` | conciliador | fila de conciliação |
| `operador@abdcm.org.br` | operador | lotes, encerramento, protocolo |
| `suporte@abdcm.org.br` | suporte | contestações |
| `financeiro@abdcm.org.br` | financeiro | ledger e preços |
| `admin@abdcm.org.br` | administrador | tudo, menos o portal do parceiro |

O administrador **não** entra no portal do parceiro por permissão herdada: esse acesso passa por
impersonação rastreada ("Ver como parceiro"), com banner permanente e registro em auditoria.

## Verificação

```bash
npm test          # 133 testes de domínio (Vitest) — não tocam o banco
npm run typecheck # TypeScript strict, sem erros
npm run build     # build de produção
npm run test:e2e  # 21 checks no navegador contra o Postgres de verdade (exige o servidor
                  # rodando e, na primeira vez, o navegador do Playwright:
                  # npx playwright install chromium)
```

Os testes de domínio cobrem as 11 transições válidas da máquina de estados, a **matriz completa
das transições proibidas**, a exigência de `reason_code` + observação, a separação de funções
entre os 6 papéis e o mascaramento de CPF/CNPJ.

Os checks de navegador cobrem o login dos 6 papéis, a recusa de senha errada com mensagem
idêntica à de usuário inexistente, o bloqueio por papel em cada rota administrativa, a máscara de
documento na listagem, a revelação auditada, a aprovação na conciliação e a consulta pública —
com escritas reais no banco: uma aprovação feita num boot do servidor continua lá depois de matar
o processo e subir outro do zero (é exatamente o cenário de uma função serverless na Vercel).

## Deploy (Vercel)

Importe o repositório apontando **Root Directory** para `abdcm`, defina `SESSION_SECRET` e
`DATABASE_URL` (Vercel Postgres resolve os dois com um clique em Storage → Create Database →
Postgres, que já injeta `DATABASE_URL` no projeto) e rode `npm run db:migrate && npm run db:seed`
uma vez, localmente, apontando para essa mesma `DATABASE_URL` de produção. Depois disso, todo
`git push` na branch de produção publica sozinho.

## Roteiro sugerido de demonstração

1. **`/login`** — entrar como `conciliador`. Repare no menu: os itens que o papel não pode acessar
   não são escondidos no cliente, eles não existem no HTML.
2. **`/admin`** — painel do dia. Não é dashboard de métricas; é a lista do que precisa de atenção.
3. **`/admin/conciliacao`** — aprovar um item. Cada registro transiciona pelo caminho único do
   domínio e grava seu `ProcessEvent`. Reprovar exige código de motivo de lista fechada mais
   observação, e o texto vai literalmente para o parceiro.
4. Digitar `/admin/auditoria` na barra de endereços com esse mesmo papel: **acesso negado pelo
   servidor**, não pela interface.
5. Entrar como `admin`, abrir um registro em **`/admin/registros`** e clicar em *revelar*: o CPF
   completo só é resolvido no servidor, sob clique explícito, e a revelação aparece em
   **`/admin/auditoria`** com quem, quando e qual registro.
6. **`/admin/lote`** — encerramento por gates: o botão só libera quando os bloqueios são
   resolvidos, cada grupo em alerta tem destino escolhido e o nome do lote é digitado.
7. **`/app`** — portal do parceiro, com o contador do lote vigente ao vivo.
8. **`/consulta`** — protocolo errado devolve a mesma resposta que CPF inexistente; o correto
   devolve a timeline inteira do processo.

## O que está pronto e o que não está

**Pronto:** os três frontends com layout e navegação, autenticação com sessão assinada no
servidor, os 6 papéis com a matriz de permissões aplicada por rota, a máquina de estados como
módulo de domínio puro com testes, **persistência real em Postgres via Drizzle** (o mesmo dado
sobrevive a reiniciar o servidor), o mascaramento e a revelação auditada de documentos, a fila de
conciliação funcional gravando no banco, o preview de encerramento por gates, a timeline de
`ProcessEvent` com trigger de imutabilidade no próprio banco, a consulta pública com rate
limiting.

**Ainda não:** integrações reais de PIX, WhatsApp e assinatura (os adaptadores estão
especificados, os providers não foram escritos), importação de planilha, esteira de protocolo e
retorno, ledger e o agente de IA. Tudo isso é Fase 1 em diante — ver as fases em `CLAUDE.md`. A
persistência foi antecipada da Fase 1 para a Fase 0 a pedido explícito, para viabilizar um deploy
estável fora do `localhost`.

## Estrutura

```
src/
  domain/registros/state-machine.ts   ← máquina de estados, domínio puro, sem I/O
  domain/pagamentos/reason-codes.ts   ← listas fechadas de motivo (I11)
  lib/                                ← auth, authz, documento (máscara), money (centavos)
  store/repo.ts                       ← camada de acesso ao Postgres; único caminho de escrita de status
  db/
    schema.ts                        ← tabelas Drizzle (as que a aplicação já consulta)
    migrations/0001_schema_inicial.sql  ← schema Postgres completo, com triggers de imutabilidade
    client.ts, migrate.ts, seed.ts   ← conexão, aplicador de migrations, dados de demonstração
  app/(login | app | admin | consulta)
```
