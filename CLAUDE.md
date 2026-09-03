# CLAUDE.md — Plataforma ABDCM

> Este arquivo é a **memória do projeto**. Ele foi escrito para que uma sessão futura,
> sem nenhum contexto anterior, consiga trabalhar corretamente lendo só este documento.
> A especificação integral e original está em `docs/PROMPT-ABDCM-COMPLETO.md` — em caso de
> divergência, aquele arquivo é a fonte de verdade; este é o resumo operacional.

---

## 1. O domínio em um parágrafo

A **ABDCM** é uma associação civil brasileira de defesa do consumidor. **Parceiros**
(revendedores autônomos, PF ou PJ) captam pessoas com restrição de crédito. Cada pessoa
**se filia à ABDCM** assinando eletronicamente uma **ficha associativa** — e é como
**associado**, não como cliente, que ela entra em uma **Ação Coletiva**. Uma Ação Coletiva é
um **lote global numerado** (ex.: "AÇÃO COLETIVA 124") com data e hora fixas de encerramento;
todos os parceiros contribuem para o mesmo lote vigente e quem não envia antes do encerramento
espera o próximo (cadência de 4 a 11 dias). O parceiro cadastra associados (individualmente ou
por planilha), seleciona os que quer enviar, e o sistema cria uma **submissão** (unidade de
cobrança) com o preço unitário congelado, gera um **PIX automático** com QR Code, recebe a
confirmação por **webhook** e avança tudo sozinho, sem intervenção humana. Ao encerrar o lote,
o administrador gera um **pacote** (planilha + fichas assinadas + relatório de conferência) e
envia a um **escritório jurídico parceiro externo**, que protocola junto aos birôs (Serasa, SPC,
Boa Vista, Cenprot BR e Cenprot SP), devolve a referência de protocolo e, 30 a 90 dias depois,
um **arquivo de retorno** com as baixas. O associado acompanha por um **bot de WhatsApp** e por
um **portal público de consulta** (CPF + protocolo, sem login).

**Por que "associado" e não "cliente":** o cliente final não compra um serviço, ele se associa.
A ficha associativa é, ao mesmo tempo, o instrumento de filiação e o **consentimento LGPD** para
tratamento do CPF. Logo: `Associado` é entidade de primeira classe, com ciclo de vida próprio e
independente de estar em um lote; um associado pode entrar em vários lotes ao longo do tempo
(inclusive em reprotocolo); a ficha assinada é gate de envio; o telefone coletado na ficha é o
que torna o bot possível; e a ficha precisa ser recuperável por associado com data, IP e hash.

---

## 2. Os 11 invariantes (na íntegra)

Não são preferências de estilo. Se uma implementação violar qualquer um deles, **está errada** —
mesmo que funcione, mesmo que passe nos testes, mesmo que tenha sido pedida.

**I1 — Nenhuma regra de negócio no cliente.** Preço, transição de status, gate de filiação,
cálculo de reprotocolo, permissão: tudo validado no servidor. O navegador **nunca** fala com o
banco diretamente. Nada de PostgREST/Supabase-client no frontend. Todo acesso a dado passa pela
nossa API.

**I2 — Toda transição de status grava um `ProcessEvent` imutável** (de, para, ator, tipo de ator,
motivo, timestamp). Sem exceção, inclusive em operações em massa. Garanta isso na camada de
domínio: não deve existir caminho no código capaz de alterar status sem gerar o evento. Isso é
estrutura, não disciplina.

**I3 — Nenhuma operação em massa sem preview de diff.** O padrão é sempre: carregar → mostrar o
que vai mudar, o que não vai e por quê → confirmar → executar → relatório do resultado real.
Nunca "selecionar tudo → aplicar".

**I4 — `unit_price` é congelado no registro no momento do envio e imutável depois.** A precedência
(preço do parceiro → preço do lote → preço padrão do tenant) é resolvida uma única vez, no
servidor. Não existe alteração retroativa de preço — apenas lançamento de ajuste no ledger.

**I5 — Ficha associativa assinada é gate de envio.** Nenhum registro entra em lote encerrado sem
consentimento documentado (data, IP, hash do documento). Exceção somente com justificativa
registrada em auditoria, e a exceção precisa ser um caminho explícito e visível, não um bypass
silencioso.

**I6 — CPF/CNPJ mascarado por padrão em toda tela administrativa.** Formato `123.***.**9-00`.
Revelação sob clique explícito, e a revelação é registrada em auditoria com quem, quando e qual
registro.

**I7 — O bot de WhatsApp só responde sobre dados que pertencem a quem está falando.** A identidade
é resolvida pelo telefone do remetente **antes** de qualquer ferramenta rodar. As ferramentas
expostas ao agente **não aceitam CPF como parâmetro de busca** — aceitam apenas ids já resolvidos
e validados como pertencentes ao remetente. Número não cadastrado não recebe informação alguma,
nem a confirmação de que um CPF existe na base.

**I8 — Nunca coletar credencial de terceiro.** Senha de banco, Gov.br, e-CAC, portal de birô,
qualquer uma. Se algum requisito futuro parecer exigir isso, **pare e pergunte ao usuário**. Não
implemente e não proponha contorno.

**I9 — `tenant_id` (uuid, not null) em toda tabela de domínio**, desde a primeira migration, com
índice composto `(tenant_id, ...)` em toda consulta e filtro obrigatório em toda query. A
interface é single-tenant (ABDCM), sem seletor visível. É preparação para white-label, não feature
de hoje.

**I10 — Nenhum segredo no repositório.** Chaves de API, certificados e tokens exclusivamente por
variável de ambiente. `.env.example` com as chaves vazias e comentadas. Nunca escreva um valor real
de credencial em nenhum arquivo, nem em teste, nem em comentário, nem em exemplo.

**I11 — Toda ação destrutiva ou financeira exige `reason_code` de lista fechada + observação
livre.** Não aceite apenas texto livre opcional. O código de motivo é o que permite medir
qualidade depois.

---

## 3. Os oito status de processo (+2)

Valores exatos, em snake_case. **Nunca invente um nono.**

| Valor | Significado |
|---|---|
| `pendente` | Registro cadastrado, aguardando envio da lista |
| `enviado` | Lista enviada, aguardando pagamento |
| `aguardando_pagamento` | Pagamento em análise (comprovante manual ou divergência) |
| `pago` | Pagamento confirmado, entra em processamento |
| `reprovado` | Problema com o pagamento — precisa reenviar |
| `aguardando_protocolo` | Registro sendo preparado para protocolo |
| `protocolado` | Protocolado junto aos birôs, em processamento |
| `baixado` | Processo finalizado com sucesso |
| `recusado` | Recusa do birô, vinda no arquivo de retorno |
| `cancelado` | Exceção administrativa |

**Máquina de estados (única fonte de verdade das transições):**

```
pendente             ──[enviar lista]───────────────> enviado
enviado              ──[webhook PIX confirmado]─────> pago
enviado              ──[comprovante manual anexado]─> aguardando_pagamento
aguardando_pagamento ──[aprovado]───────────────────> pago
aguardando_pagamento ──[rejeitado]──────────────────> reprovado
reprovado            ──[novo comprovante]───────────> aguardando_pagamento
pago                 ──[automático]─────────────────> aguardando_protocolo
aguardando_protocolo ──[protocolo registrado]───────> protocolado
protocolado          ──[retorno: baixado]───────────> baixado
protocolado          ──[retorno: recusado]──────────> recusado
qualquer             ──[exceção admin com motivo]───> cancelado
```

Toda transição não listada é **proibida** e falha com erro de domínio. Existem testes para cada
transição válida **e** para cada proibida.

**Ciclo de vida do lote:** `rascunho | aberto | encerrado | em_protocolo | protocolado | concluido`
**Ciclo de filiação:** `pre_cadastro | ficha_enviada | ficha_assinada | ativo | inativo`
**Status de pagamento da submissão:** `pendente | pago | expirado | reprovado | cancelado`

---

## 4. Regras de negócio essenciais

**Preço e cobrança**
- Cobrança **pré-paga e integral**, antes de qualquer processamento.
- **PIX é o único meio de pagamento.**
- Valor da submissão = soma dos `unit_price` congelados dos registros.
- Precedência de preço: preço do parceiro → preço do lote → preço padrão do tenant.
- Registros de bônus entram com `unit_price = 0` e `is_bonus = true`.
- **Dinheiro sempre em centavos, inteiro. Nunca float. Nunca.**

**Reprotocolo**
- Elegíveis: registros já enviados que não tiveram baixa.
- **Gratuito até 30 dias** da data de envio; após 30 dias, **percentual configurável** do preço
  unitário (padrão 85%).
- Entra no **lote vigente**, com `reprotocol_of_registro_id` preenchido — nunca cria lote novo.

**Premiação por volume** (nomes grátis por meta acumulada de nomes enviados)

| Meta | Bônus |
|---|---|
| 100 | +3 |
| 500 | +10 |
| 1.000 | +20 |
| 5.000 | +50 |
| 10.000 | +100 |

**Contestação (canal "Reclame Aqui")**
- Abertura **bloqueada até 72h** após o lote estar `concluido` — validação de servidor, não aviso
  de tela.
- SLA de resposta: **48h**, com cronômetro visível na fila do admin.
- Motivo inicial único: "lista concluiu e o nome não baixou".

**Prazos declarados** (configuráveis, exibidos ao usuário, **nunca inventados pelo agente de IA**)
- Processamento: 30 a 90 dias úteis
- Contestação: carência 72h, SLA 48h
- Reprotocolo gratuito: 30 dias
- Expiração do PIX: 60 minutos

---

## 5. Stack (decidida — não propor alternativas)

- **Next.js (App Router)** + **TypeScript strict** + **Tailwind**
- **Postgres** via **Supabase** (banco, Auth, Storage). RLS como **segunda** camada de defesa,
  nunca a única.
- **Drizzle ORM** + migrations versionadas em SQL
- **Zod** validando a entrada de toda rota
- **pg-boss** para filas e agendamento (importação, notificação, reconciliação ativa, SLA)
- **Vitest** para testes de domínio

**Três frontends, um projeto:**

| Superfície | Domínio | Quem acessa |
|---|---|---|
| Portal do parceiro | `app.*` | parceiro autenticado |
| Console administrativo | `admin.*` | equipe ABDCM, por papel |
| Consulta pública | `consulta.*` | qualquer pessoa, sem login |

---

## 6. Convenção de nomes

- **Código, infraestrutura e tipos técnicos: inglês.**
- **Entidades e conceitos de domínio: português**, porque é a linguagem do negócio e tem peso
  jurídico. Tabelas: `associados`, `parceiros`, `lotes`, `registros`, `submissoes`,
  `process_events`, `pix_cobrancas`, `contestacoes`, `pacotes_lote`.
- Valores de enum em snake_case português, exatamente os da seção 3.
- **Commits e documentação em português.**

---

## 7. Estrutura de pastas — por domínio, não por tipo de arquivo

```
src/
  domain/
    associados/      { model, service, rules, tests }
    lotes/
    registros/       ← inclui a máquina de estados
    submissoes/
    pagamentos/
    protocolo/
    contestacoes/
    financeiro/
    notificacoes/
  integrations/
    pix/             { PixProvider (interface), MockProvider, AsaasProvider }
    whatsapp/        { WhatsAppProvider, MockProvider, MetaCloudProvider }
    assinatura/      { AssinaturaProvider, MockProvider, ZapSignProvider }
  db/                { schema, migrations, seeds }
  jobs/              { workers pg-boss }
  app/
    (parceiro)/
    (admin)/
    (publico)/
    api/
  lib/               { auth, authz, masking, validation, money }
```

---

## 8. Integrações — todas atrás de adaptador

Nenhum SDK de terceiro vaza para dentro do domínio. Para cada integração: **defina a interface
primeiro, implemente o Mock que funciona sozinho, e só depois o provider real.**

```ts
interface PixProvider {
  criarCobranca(input: {
    valor: number                    // centavos, sempre inteiro
    referenciaExterna: string        // submissao.id
    pagador: { nome: string; cpfCnpj: string }
    expiraEmSegundos: number
    descricao: string
  }): Promise<{ txid: string; qrCodeBase64: string; copiaECola: string; expiraEm: Date }>

  consultarCobranca(txid: string): Promise<StatusCobranca>
  validarWebhook(payload: unknown, headers: Headers): Promise<EventoPagamento>
}

interface WhatsAppProvider {
  enviarTemplate(input: { telefone: string; template: string; variaveis: Record<string,string> }): Promise<{ wamid: string }>
  enviarTextoLivre(input: { telefone: string; texto: string }): Promise<{ wamid: string }>
  validarWebhook(payload: unknown, headers: Headers): Promise<MensagemRecebida>
}

interface AssinaturaProvider {
  criarEnvelope(input: { signatario: {...}; documento: Buffer }): Promise<{ envelopeId: string; urlAssinatura: string }>
  validarWebhook(payload: unknown, headers: Headers): Promise<EventoAssinatura>
}
```

**O desenvolvimento inteiro precisa rodar com os mocks, sem nenhuma conta externa.** Não é
conveniência — é requisito, porque as contas reais ainda não existem. Providers reais previstos:
PIX = **Asaas**; WhatsApp = **Meta Cloud API**; assinatura = ZapSign ou Clicksign.

---

## 9. WhatsApp — a restrição que organiza o desenho

A API oficial trata de forma diferente mensagem iniciada por nós (exige **template pré-aprovado
pela Meta**, texto fixo com variáveis) e mensagem iniciada pelo usuário (abre **janela de 24h** em
que podemos responder **texto livre**, inclusive gerado por IA).

Envio de template e envio de texto livre são **caminhos separados no código**, com controle da
janela de 24h por conversa: texto livre só é permitido com janela aberta; se estiver fechada, o
sistema **deve** cair para template. Isso é impossível de errar por construção — a decisão não fica
para quem chama.

**Agente de IA:** não é um LLM solto com acesso ao banco. É um agente com **ferramentas estreitas**,
todas já escopadas pelo remetente (I7):

```
consultarMinhasSolicitacoes()          → registros do associado
consultarStatusDetalhado(registroId)   → valida propriedade antes de responder
consultarProximoLote()
consultarPendencias()                  → ficha não assinada, pagamento pendente
abrirAtendimentoHumano(motivo)         → escala e encerra o bot
```

Número desconhecido recebe apenas: *"Não localizei um cadastro com este número. Fale com o parceiro
que fez sua filiação ou consulte em consulta.abdcm.* com seu CPF e protocolo."* — sem revelar nada,
nem a existência do CPF. Parceiro cadastrado consultando sobre seus associados → escopo dos próprios
associados, nunca da base inteira.

**Restrições duras no prompt do agente:** não prometer resultado · não dar orientação jurídica · não
discutir valor, negociação ou reembolso (escala) · não confirmar nem negar cadastro para número
desconhecido · **não inventar prazo** (só os configurados no sistema) · em dúvida, escalar em vez de
improvisar. Toda conversa é persistida com as ferramentas chamadas.

---

## 10. Papéis e separação de funções

Quem concilia pagamento **não pode** alterar preço; quem atende cliente **não pode** mudar status;
quem opera lote **não pode** aprovar pagamento.

| Papel | Faz | Não faz |
|---|---|---|
| `parceiro` | portal do parceiro | qualquer coisa administrativa |
| `conciliador` | fila de conciliação, aprovar/reprovar | ledger completo, preços, revelar CPF |
| `operador` | lotes, encerramento, protocolo, baixa em massa | aprovar pagamento, preços, usuários |
| `suporte` | contestações, consultar registros, impersonar em leitura | qualquer escrita financeira ou de status |
| `financeiro` | ledger, assinaturas, bônus, ajustes, relatórios | mudar status de processo, encerrar lote |
| `administrador` | tudo, incluindo configuração e usuários | — |

---

## 11. Ordem de execução (fases)

Cada fase entrega algo que funciona sozinho. **Não gerar código de fases futuras.** Ao fim de cada
fase: resumo do que foi feito, o que ficou de fora, e o que precisa ser decidido para a próxima.

- **FASE 0 — Fundação.** `CLAUDE.md` · scaffold (Next + TS strict + Tailwind + Drizzle + Vitest +
  lint/format) · `.env.example` documentado · schema completo em migrations SQL · Auth e os 6 papéis
  · máquina de estados como módulo de domínio puro com testes de cada transição válida e proibida ·
  layout base dos três frontends.
  *Pronto quando:* migrations rodam do zero, testes da máquina de estados passam, login funciona com
  os 6 papéis.
- **FASE 1 — Núcleo operacional.** Filiação com assinatura (mock) · cadastro individual e importação
  de planilha com preview/dedup/relatório · console do lote com encerramento por gates · envio de
  lista com bloqueio · PIX automático + webhook + idempotência + reconciliação ativa · fila de
  conciliação · painel do dia · histórico com filtros e exportação · consulta pública com timeline.
- **FASE 2 — Comunicação.** WhatsAppProvider com mock · janela de 24h · ~8 templates · motor de
  notificação com fila, retry e fallback · agente de IA com escopo por telefone · notificações
  in-app. *Pronto quando os testes de vazamento passam.*
- **FASE 3 — Esteira e ciclo completo.** Pacote do lote · registro de protocolo · importação de
  retorno com preview de diff · baixa em massa · `protocol_code` e comprovante PDF com QR
  verificável · reprotocolo (regra dos 30 dias) · contestações (72h / 48h).
- **FASE 4 — Gestão e conformidade.** Ledger e extrato · premiação por volume · assinaturas ·
  ficha do parceiro com impersonação rastreada · auditoria com diff · console LGPD · relatórios.
- **FASE 5 — Camada comercial.** Só mediante pedido explícito.

---

## 12. Testes obrigatórios

Não são opcionais e não entram como "depois".

**Domínio:** cada transição válida funciona · **cada transição proibida falha** com erro de domínio
· `unit_price` congela no envio e não muda depois · precedência de preço na ordem correta ·
reprotocolo grátis em D+29 e cobrado em D+31 · gates de encerramento bloqueiam quando devem ·
contestação recusada antes de 72h da conclusão.

**Integração:** webhook duplicado (mesmo `evento_id`) não processa duas vezes · webhook fora de
ordem não regride status · PIX expirado e pago depois cai na fila de exceção, não em `pago` · valor
divergente não confirma automaticamente · reconciliação ativa resolve cobrança sem webhook.

**Segurança e privacidade — os mais importantes do projeto:** número não cadastrado não recebe
informação sobre nenhum CPF, por nenhum caminho · remetente A não alcança dados do associado B, por
nenhum caminho, incluindo tentativa de passar CPF ou id na mensagem · parceiro A não vê dados do
parceiro B · consulta entre tenants é impossível · texto livre bloqueado com janela de 24h fechada ·
cada papel só executa o que lhe cabe (teste por papel, por rota) · CPF vem mascarado por padrão nas
respostas do admin · revelação de CPF gera registro em auditoria.

**Importação:** duplicidade detectada no arquivo e contra o histórico · CPF inválido rejeitado com a
linha identificada · planilha malformada não quebra a importação inteira · **preview não escreve
nada no banco**.

---

## 13. Como trabalhar neste projeto

- Incrementos pequenos e verificáveis. **Rodar os testes antes de dizer que algo está pronto.**
- Se uma decisão não estiver na especificação e for relevante, **perguntar** em vez de presumir.
- Discordância da especificação se declara **antes** de implementar diferente.
- Commits e documentação em português.

**Nunca:** colocar credencial em arquivo · implementar coleta de senha de terceiro (parar e
perguntar — I8) · criar caminho que mude status sem `ProcessEvent` · criar operação em massa sem
preview · deixar o frontend falar com o banco direto.

**Este sistema movimenta dinheiro de uma associação e processa CPF de terceiros. Bug aqui é
incidente de LGPD ou dinheiro no lugar errado — não botão desalinhado. Prefira a implementação
correta e um pouco mais lenta.**
