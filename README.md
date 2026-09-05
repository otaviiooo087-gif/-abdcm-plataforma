# Plataforma ABDCM

Protótipo da plataforma de gestão de ação coletiva e filiação da ABDCM (Associação Brasileira
de Defesa do Consumidor e do Trabalhador). Ver `CLAUDE.md` para a memória completa do projeto e
`docs/PROMPT-ABDCM-COMPLETO.md` para a especificação de negócio integral.

**Estado atual:** este é o protótipo gerado no Google AI Studio — Vite + React + Express, com
os dados em memória (`src/server/mockDb.ts`). Reiniciar o servidor apaga tudo. Não há login real
(a troca de papel é só pra demonstração, sem senha) nem persistência em Postgres. Ver a nota no
topo da seção 5 do `CLAUDE.md` pra entender por que diverge da stack originalmente decidida.

## Rodar localmente

Pré-requisitos: Node.js 20+.

```bash
npm install
npm run dev
```

Abre em `http://localhost:3000`. O `GEMINI_API_KEY` do `.env.example` não é usado por nenhum
código atualmente (nenhum recurso de IA foi implementado ainda) — pode deixar em branco.

## Scripts

- `npm run dev` — servidor de desenvolvimento (Express + Vite middleware)
- `npm run build` — build de produção (`vite build` + bundle do servidor com esbuild)
- `npm start` — roda o build de produção (`dist/server.cjs`)
- `npm test` — testes de domínio (Vitest)
- `npm run lint` — checagem de tipos (`tsc --noEmit`)

## Deploy (Railway)

1. **railway.app** → **New Project → Deploy from GitHub repo** → escolha este repositório.
2. Não precisa de banco de dados nesta versão (dados em memória).
3. Deploy — o servidor lê a porta de `process.env.PORT` automaticamente.

Cada reinício do container zera os dados de demonstração.
