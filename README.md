# Plataforma ABDCM

Protótipo da plataforma de gestão de ação coletiva e filiação da ABDCM (Associação Brasileira
de Defesa do Consumidor e do Trabalhador). Ver `CLAUDE.md` para a memória completa do projeto e
`docs/PROMPT-ABDCM-COMPLETO.md` para a especificação de negócio integral.

**Estado atual:** protótipo gerado no Google AI Studio — Vite + React + Express — com
persistência real em Postgres via Drizzle (`src/server/db/`). Não há login com senha real (a
troca de papel em `/api/auth/switch-role` é só pra demonstração), mas os dados de negócio
(lotes, associados, registros, submissões, eventos de processo, auditoria) sobrevivem a
reinícios do processo. Ver a nota no topo da seção 5 do `CLAUDE.md` pra entender o que ainda
diverge da stack originalmente decidida.

## Rodar localmente

Pré-requisitos: Node.js 20+ e um Postgres (local, Docker, ou qualquer provedor gerenciado).

```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL
npm run db:migrate
npm run db:seed
npm run dev
```

Abre em `http://localhost:3000`. O `GEMINI_API_KEY` do `.env.example` não é usado por nenhum
código atualmente (nenhum recurso de IA foi implementado ainda) — pode deixar em branco.

## Scripts

- `npm run dev` — servidor de desenvolvimento (Express + Vite middleware)
- `npm run build` — build de produção (`vite build` + bundle do servidor com esbuild)
- `npm start` — aplica migrations pendentes e roda o build de produção (`dist/server.cjs`)
- `npm run db:migrate` — aplica as migrations de `src/server/db/migrations/` (idempotente)
- `npm run db:seed` — popula o banco com os dados de demonstração (rodar uma vez, contra um
  banco vazio — não é idempotente, rodar duas vezes duplica os dados)
- `npm test` — testes de domínio (Vitest)
- `npm run lint` — checagem de tipos (`tsc --noEmit`)

## Deploy (Railway)

1. **railway.app** → **New Project → Deploy from GitHub repo** → escolha este repositório.
2. No mesmo projeto → **New → Database → PostgreSQL** — a Railway injeta `DATABASE_URL`
   automaticamente no serviço da aplicação (referência, não copie o valor manualmente).
3. Deploy — o servidor lê a porta de `process.env.PORT` automaticamente, e `npm start` aplica
   as migrations sozinho a cada boot.
4. Popular com dados de demonstração: no **Console** do serviço da aplicação (não do Postgres),
   rode `npm run db:seed` — usa a rede privada da Railway, sem precisar expor o banco
   publicamente.

*(Se o banco precisar ser acessado de fora da rede da Railway — ex.: GitHub Actions — use o
endpoint público do Postgres, não o interno `*.railway.internal`, e confira que a senha não tem
caractere especial sem percent-encoding: `src/server/db/ssl.ts` já ajuda a diagnosticar isso.)*
