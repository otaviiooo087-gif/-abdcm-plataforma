# ABDCM — Plataforma de Ação Coletiva

Fase 0 (fundação) da plataforma de gestão de ação coletiva da ABDCM.
A especificação completa está em [`docs/PROMPT-ABDCM-COMPLETO.md`](docs/PROMPT-ABDCM-COMPLETO.md);
o resumo operacional, em [`CLAUDE.md`](CLAUDE.md).

## Como rodar

```bash
npm install
npm run dev        # gera o .env.local automaticamente e sobe em http://localhost:3000
```

Não é preciso banco, conta de Supabase nem nenhum serviço externo: esta fase roda com um
repositório em memória, semeado com dados de demonstração a cada boot.

### Contas de demonstração

Senha de todas: `abdcm2026` (definível por `DEMO_PASSWORD`; é semente local, não credencial
de sistema real — o hash é gerado em tempo de execução e nunca versionado).

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
npm test          # 133 testes de domínio (Vitest)
npm run typecheck # TypeScript strict, sem erros
npm run build     # build de produção
npm run test:e2e  # 21 checks no navegador (exige o servidor rodando)
```

Os testes de domínio cobrem as 11 transições válidas da máquina de estados, a **matriz completa
das transições proibidas**, a exigência de `reason_code` + observação, a separação de funções
entre os 6 papéis e o mascaramento de CPF/CNPJ.

Os checks de navegador cobrem o login dos 6 papéis, a recusa de senha errada com mensagem
idêntica à de usuário inexistente, o bloqueio por papel em cada rota administrativa, a máscara de
documento na listagem, a revelação auditada, a aprovação na conciliação e a consulta pública.

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
módulo de domínio puro com testes, o mascaramento e a revelação auditada de documentos, a fila de
conciliação funcional, o preview de encerramento por gates, a timeline de `ProcessEvent`, a
consulta pública com rate limiting e o schema SQL completo em `src/db/schema.sql`.

**Ainda não:** persistência em Postgres (a aplicação roda em memória), integrações reais de PIX,
WhatsApp e assinatura (os adaptadores estão especificados, os providers não foram escritos),
importação de planilha, esteira de protocolo e retorno, ledger e o agente de IA. Tudo isso é
Fase 1 em diante — ver as fases em `CLAUDE.md`.

## Estrutura

```
src/
  domain/registros/state-machine.ts   ← máquina de estados, domínio puro, sem I/O
  domain/pagamentos/reason-codes.ts   ← listas fechadas de motivo (I11)
  lib/                                ← auth, authz, documento (máscara), money (centavos)
  store/                              ← repositório em memória; único caminho de escrita de status
  db/schema.sql                       ← schema Postgres completo, com triggers de imutabilidade
  app/(login | app | admin | consulta)
```
