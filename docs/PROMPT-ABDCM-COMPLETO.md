# PROMPT COMPLETO — Plataforma ABDCM

> **Como usar:** este arquivo inteiro É o prompt. Duas opções:
> **(a)** copie tudo e cole no Claude Code; ou
> **(b)** salve na raiz do projeto e diga: *"Leia PROMPT-ABDCM-COMPLETO.md e execute."*
> A opção (b) é melhor — o arquivo fica no repo e pode ser reconsultado em qualquer sessão.

---

Você vai construir a plataforma de gestão de ação coletiva da **ABDCM**, uma associação civil brasileira de defesa do consumidor. Este documento é a especificação completa e a fonte de verdade do projeto.

Leia tudo antes de escrever a primeira linha de código.

---

# PARTE 0 — AS 11 REGRAS INVIOLÁVEIS

Leia esta parte duas vezes. Não são preferências de estilo. Se uma implementação sua violar qualquer uma delas, está errada — mesmo que funcione, mesmo que passe nos testes, mesmo que eu tenha pedido. Sete destas existem porque um sistema concorrente as viola, e é exatamente por isso que ele é manual, não notifica ninguém e não consegue provar o que aconteceu.

**I1 — Nenhuma regra de negócio no cliente.** Preço, transição de status, gate de filiação, cálculo de reprotocolo, permissão: tudo validado no servidor. O navegador **nunca** fala com o banco diretamente. Nada de PostgREST/Supabase-client no frontend. Todo acesso a dado passa pela nossa API.

**I2 — Toda transição de status grava um `ProcessEvent` imutável** (de, para, ator, tipo de ator, motivo, timestamp). Sem exceção, inclusive em operações em massa. Garanta isso na camada de domínio: não deve existir caminho no código capaz de alterar status sem gerar o evento. Isso é estrutura, não disciplina.

**I3 — Nenhuma operação em massa sem preview de diff.** O padrão é sempre: carregar → mostrar o que vai mudar, o que não vai e por quê → confirmar → executar → relatório do resultado real. Nunca "selecionar tudo → aplicar".

**I4 — `unit_price` é congelado no registro no momento do envio e imutável depois.** A precedência (preço do parceiro → preço do lote → preço padrão do tenant) é resolvida uma única vez, no servidor. Não existe alteração retroativa de preço — apenas lançamento de ajuste no ledger.

**I5 — Ficha associativa assinada é gate de envio.** Nenhum registro entra em lote encerrado sem consentimento documentado (data, IP, hash do documento). Exceção somente com justificativa registrada em auditoria, e a exceção precisa ser um caminho explícito e visível, não um bypass silencioso.

**I6 — CPF/CNPJ mascarado por padrão em toda tela administrativa.** Formato `123.***.**9-00`. Revelação sob clique explícito, e a revelação é registrada em auditoria com quem, quando e qual registro.

**I7 — O bot de WhatsApp só responde sobre dados que pertencem a quem está falando.** A identidade é resolvida pelo telefone do remetente **antes** de qualquer ferramenta rodar. As ferramentas expostas ao agente **não aceitam CPF como parâmetro de busca** — aceitam apenas ids já resolvidos e validados como pertencentes ao remetente. Número não cadastrado não recebe informação alguma, nem a confirmação de que um CPF existe na base. Um bot que responde "status do CPF X" para quem perguntar é vazamento de dado pessoal por design.

**I8 — Nunca coletar credencial de terceiro.** Senha de banco, Gov.br, e-CAC, portal de birô, qualquer uma. Se algum requisito futuro parecer exigir isso, **pare e me pergunte**. Não implemente e não proponha contorno.

**I9 — `tenant_id` (uuid, not null) em toda tabela de domínio**, desde a primeira migration, com índice composto `(tenant_id, ...)` em toda consulta e filtro obrigatório em toda query. A interface é single-tenant (ABDCM), sem seletor visível. Isso é preparação para white-label, não feature de hoje.

**I10 — Nenhum segredo no repositório.** Chaves de API, certificados e tokens exclusivamente por variável de ambiente. Crie `.env.example` com as chaves vazias e comentadas. Nunca escreva um valor real de credencial em nenhum arquivo, nem em teste, nem em comentário, nem em exemplo.

**I11 — Toda ação destrutiva ou financeira exige `reason_code` de lista fechada + observação livre.** Não aceite apenas texto livre opcional. O código de motivo é o que permite medir qualidade depois.

---

# PARTE 1 — O DOMÍNIO

## 1.1 Como o negócio funciona

**Parceiros** (revendedores autônomos, pessoa física ou jurídica) captam clientes com restrição de crédito. Cada cliente **se filia à ABDCM** assinando eletronicamente uma **ficha associativa** — e é como **associado** que ele entra em uma **Ação Coletiva**.

Uma Ação Coletiva é um **lote global numerado** (ex.: "AÇÃO COLETIVA 124") com **data e hora fixas de encerramento**. Todos os parceiros contribuem para o mesmo lote vigente. Quem não envia antes do encerramento espera o próximo. A cadência é de aproximadamente 4 a 11 dias entre lotes.

O parceiro cadastra associados (individualmente ou por planilha), seleciona os que quer enviar, e o sistema:
1. cria uma **submissão** (a unidade de cobrança) com o preço unitário congelado
2. gera um **PIX automático** com QR Code
3. recebe a confirmação por **webhook** e avança tudo sozinho, sem intervenção humana

Quando o lote encerra, o administrador gera um **pacote** (planilha de registros + fichas assinadas + relatório de conferência) e envia a um **escritório jurídico parceiro externo**, que protocola junto aos birôs de crédito (Serasa, SPC, Boa Vista, Cenprot BR e Cenprot SP). O escritório devolve a referência de protocolo e, 30 a 90 dias depois, um **arquivo de retorno** com as baixas.

O associado acompanha por um **bot de WhatsApp** e por um **portal público de consulta** (CPF + protocolo, sem login).

## 1.2 Por que "associado" e não "cliente"

Isto reorganiza o modelo de dados, então preste atenção: o cliente final **não compra um serviço** — ele **se associa à ABDCM**, e a filiação é o veículo jurídico que o coloca na ação coletiva. A ficha associativa é, simultaneamente, o instrumento de filiação e o **consentimento LGPD** do titular para tratamento do CPF dele.

Consequências:
- `Associado` é entidade de primeira classe, com ciclo de vida próprio, **independente de estar em um lote**
- Um associado pode entrar em vários lotes ao longo do tempo (inclusive em reprotocolo)
- A filiação assinada é gate de envio (I5)
- O telefone do associado, coletado na ficha, é o que torna o bot possível (I7)
- A ficha assinada é prova de consentimento e precisa ser recuperável por associado, com data, IP e hash

## 1.3 Os oito status de processo

Estes nomes são os do negócio. Use **exatamente** estes valores, em snake_case, e nunca invente um nono.

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

Acrescente `recusado` (recusa do birô, vinda no arquivo de retorno) e `cancelado` (exceção administrativa).

**Máquina de estados:**
```
pendente ──[enviar lista]──> enviado
enviado ──[webhook PIX confirmado]──> pago
enviado ──[comprovante manual anexado]──> aguardando_pagamento
aguardando_pagamento ──[aprovado]──> pago
aguardando_pagamento ──[rejeitado]──> reprovado
reprovado ──[novo comprovante]──> aguardando_pagamento
pago ──[automático]──> aguardando_protocolo
aguardando_protocolo ──[protocolo registrado]──> protocolado
protocolado ──[retorno: baixado]──> baixado
protocolado ──[retorno: recusado]──> recusado
qualquer ──[exceção admin com motivo]──> cancelado
```
Toda transição não listada é **proibida** e deve falhar com erro de domínio. Escreva testes para cada transição válida **e** para cada proibida.

**Ciclo de vida do lote:** `rascunho | aberto | encerrado | em_protocolo | protocolado | concluido`

**Ciclo de filiação:** `pre_cadastro | ficha_enviada | ficha_assinada | ativo | inativo`

**Status de pagamento da submissão:** `pendente | pago | expirado | reprovado | cancelado`

## 1.4 Regras de negócio

**Preço e cobrança**
- Cobrança **pré-paga e integral**, antes de qualquer processamento
- **PIX é o único meio de pagamento**
- Valor da submissão = soma dos `unit_price` congelados dos registros
- Precedência de preço: preço do parceiro → preço do lote → preço padrão do tenant
- Registros de bônus entram com `unit_price = 0` e `is_bonus = true`

**Reprotocolo**
- Elegíveis: registros já enviados que não tiveram baixa
- **Gratuito até 30 dias** da data de envio
- Após 30 dias: **percentual configurável** do preço unitário (padrão 85%)
- Entra no **lote vigente**, com `reprotocol_of_registro_id` preenchido — nunca cria lote novo

**Premiação por volume** (nomes grátis por meta acumulada de nomes enviados)
| Meta | Bônus |
|---|---|
| 100 | +3 |
| 500 | +10 |
| 1.000 | +20 |
| 5.000 | +50 |
| 10.000 | +100 |

**Contestação (canal "Reclame Aqui")**
- Abertura **bloqueada até 72h** após o lote estar `concluido` (validação de servidor, não aviso de tela)
- SLA de resposta: **48h**, com cronômetro visível na fila do admin
- Motivo inicial único: "lista concluiu e o nome não baixou"

**Prazos declarados** (configuráveis, exibidos ao usuário, nunca inventados pelo agente de IA)
- Processamento: 30 a 90 dias úteis
- Contestação: carência 72h, SLA 48h
- Reprotocolo gratuito: 30 dias
- Expiração do PIX: 60 minutos

---

# PARTE 2 — ARQUITETURA

## 2.1 Stack (decidida — não proponha alternativas)

- **Next.js (App Router)** + **TypeScript strict** + **Tailwind**
- **Postgres** via **Supabase** (banco, Auth, Storage). RLS como **segunda** camada de defesa, nunca a única
- **Drizzle ORM** + migrations versionadas em SQL
- **Zod** validando a entrada de toda rota
- **pg-boss** para filas e agendamento (importação, notificação, reconciliação ativa, SLA)
- **Vitest** para testes de domínio

## 2.2 Três frontends, um projeto

| Superfície | Domínio | Quem acessa |
|---|---|---|
| Portal do parceiro | `app.*` | parceiro autenticado |
| Console administrativo | `admin.*` | equipe ABDCM, por papel |
| Consulta pública | `consulta.*` | qualquer pessoa, sem login |

## 2.3 Estrutura de pastas — por domínio, não por tipo de arquivo

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

## 2.4 Convenção de nomes — siga rigorosamente

- **Código, infraestrutura e tipos técnicos: inglês**
- **Entidades e conceitos de domínio: português**, porque é a linguagem do negócio e tem peso jurídico. Tabelas: `associados`, `parceiros`, `lotes`, `registros`, `submissoes`, `process_events`, `pix_cobrancas`, `contestacoes`, `pacotes_lote`.
- Valores de enum em snake_case português, exatamente os da Parte 1.3
- Commits e documentação em português

## 2.5 Integrações — todas atrás de adaptador

Nenhum SDK de terceiro vaza para dentro do domínio. Para cada integração: **defina a interface primeiro, implemente o Mock que funciona sozinho, e só depois o provider real.**

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

**O desenvolvimento inteiro precisa rodar com os mocks, sem nenhuma conta externa.** Não é conveniência — é requisito, porque as contas reais ainda não existem. O provider real de PIX previsto é o **Asaas**; o de WhatsApp é a **Meta Cloud API**; o de assinatura, ZapSign ou Clicksign.

**Dinheiro sempre em centavos, inteiro.** Nunca float. Nunca.

---

# PARTE 3 — MODELO DE DADOS

Todas as tabelas com `tenant_id uuid not null`, `created_at`, `updated_at`, FKs, constraints e enums de verdade no banco (não strings soltas).

```
tenants              id · nome · slug · config (jsonb)

users                id · tenant_id · email · password_hash · role
                     · is_active · email_verified_at · last_login_at
                     role: parceiro | conciliador | operador | suporte | financeiro | administrador

parceiros            id · tenant_id · user_id · nome_completo · nome_exibicao
                     · razao_social · cpf_cnpj · ddd · whatsapp
                     · cep · rua · numero · cidade · uf
                     · partner_code · indicado_por_parceiro_id
                     · preco_por_nome (centavos, nullable → herda do lote)
                     · total_nomes_enviados · contrato_aceito_em · contrato_versao
                     · assinatura_status · is_active

associados           id · tenant_id · parceiro_id · nome · cpf_cnpj · cpf_cnpj_raw
                     · tipo_documento (cpf|cnpj) · telefone_whatsapp · email
                     · status_filiacao · filiado_em
                     · consentimento_em · consentimento_ip · consentimento_hash
                     · ficha_documento_id
                     ÍNDICE ÚNICO (tenant_id, telefone_whatsapp) — identidade do bot
                     ÍNDICE (tenant_id, cpf_cnpj_raw)

lotes                id · tenant_id · nome · numero_sequencial · status
                     · abre_em · closes_at · deadline_time
                     · preco_por_nome (centavos) · bureaus (text[])
                     · referencia_protocolo · concluido_em

registros            id · tenant_id · lote_id · parceiro_id · associado_id
                     · submissao_id · nome · cpf_cnpj · cpf_cnpj_raw · tipo_documento
                     · process_status · is_locked · observacoes_internas
                     · unit_price (centavos, CONGELADO) · is_bonus
                     · protocol_code · reprotocol_of_registro_id
                     · origem (manual|planilha|reprotocolo|bonus)
                     · enviado_em · protocolado_em · baixado_em

submissoes           id · tenant_id · parceiro_id · lote_id
                     · nomes_count · valor_total (centavos) · payment_status
                     · submetido_em · confirmado_em
                     · revisado_por_user_id · reason_code · motivo_observacao

pix_cobrancas        id · tenant_id · submissao_id · provider · txid (único)
                     · valor · copia_e_cola · qrcode_path · expira_em
                     · status · pago_em · payload_webhook (jsonb)

process_events       id · tenant_id · registro_id · de_status · para_status
                     · ator_tipo (parceiro|admin|system|integracao) · ator_user_id
                     · motivo · metadata (jsonb) · ocorrido_em
                     IMUTÁVEL — sem update, sem delete

documentos           id · tenant_id · owner_type · owner_id
                     · kind (ficha|comprovante_pix|planilha_import|logo|retorno_birô|pacote)
                     · storage_path · nome_original · mime_type · size_bytes
                     · status · reason_code · versao · enviado_por_user_id

assinaturas          id · tenant_id · associado_id · provider · envelope_id
                     · status (enviado|visualizado|assinado|expirado)
                     · assinado_em · documento_id

transactions         id · tenant_id · parceiro_id
                     · tipo (cobranca|pagamento|credito_bonus|cobranca_reprotocolo
                            |ajuste|estorno|taxa_assinatura)
                     · valor · saldo_apos · referencia_tipo · referencia_id
                     · descricao · reason_code

bonus_grants         id · tenant_id · parceiro_id · meta · nomes_bonus
                     · nomes_consumidos · concedido_em · expira_em

contestacoes         id · tenant_id · parceiro_id · lote_id · registro_id
                     · reason_code · descricao · status · sla_vence_em
                     · resolvido_em · resolucao · resolvido_por_user_id

whatsapp_conversas   id · tenant_id · associado_id · parceiro_id · telefone
                     · janela_aberta_ate · ultima_mensagem_em

whatsapp_mensagens   id · tenant_id · conversa_id · direcao (entrada|saida)
                     · tipo (template|livre) · template_nome · conteudo
                     · ferramentas_chamadas (jsonb) · status_entrega · wamid (único)

webhook_eventos      id · tenant_id · provider · evento_id (ÚNICO — idempotência)
                     · payload (jsonb) · processado_em · erro · tentativas

pacotes_lote         id · tenant_id · lote_id · tipo (envio|retorno)
                     · documento_id · checksum · registros_count · gerado_por_user_id

notificacoes         id · tenant_id · destinatario_tipo · destinatario_id
                     · canal (in_app|email|whatsapp) · evento_tipo
                     · template_nome · titulo · corpo · payload (jsonb)
                     · lida_em · enviada_em · erro

system_config        tenant_id · key · value (jsonb) · descricao · atualizado_por

feature_flags        tenant_id · key · habilitado_global
                     · habilitado_para_roles (text[]) · habilitado_para_parceiros (uuid[])

audit_log            id · tenant_id · ator_user_id · acao · entidade_tipo · entidade_id
                     · antes (jsonb) · depois (jsonb) · ip · user_agent · ocorrido_em
                     IMUTÁVEL
```

---

# PARTE 4 — O QUE CONSTRUIR

## 4.1 Portal do parceiro (`app.*`)

**Autenticação** — cadastro (nome, email, DDD, WhatsApp, UF, cidade, CPF/CNPJ, senha **mínimo 8 caracteres**), confirmação de email, login, recuperação de senha. Aceite de contrato versionado com registro de data/hora/versão.

**Dashboard** — contador regressivo do lote vigente (dias/horas/min/seg, ao vivo) · resumo de registros por status (a referência não tem isso; nós temos) · pendências acionáveis (fichas não assinadas, PIX expirando) · ações rápidas.

**Filiação de associado** — cadastro (nome, CPF/CNPJ com máscara dinâmica de 11→CPF e 14→CNPJ, **validação de dígito verificador**, telefone WhatsApp obrigatório, email) → envio da ficha para assinatura eletrônica → webhook de assinatura grava consentimento (data, IP, hash) → status `ativo`. Lista de associados com status de filiação visível.

**Cadastro de registros no lote vigente**
- Individual: seleciona associado (só `ativo`) → adiciona ao lote
- **Importação de planilha** — `.xlsx`/`.csv`, máx 5MB. Mapeamento **por cabeçalho com fallback posicional** (coluna A = nome, coluna B = CPF/CNPJ, linha 1 ignorada, documento com ou sem máscara). E o que a referência não tem: **pré-visualização com contagem, detecção de duplicidade dentro do arquivo e contra o histórico, relatório de linhas com erro, e confirmação em duas etapas.** Importação grande vai para a fila com progresso visível — nunca síncrona no request.
- Botão "Baixar modelo" gerando a planilha de exemplo

**Envio de lista e pagamento**
- Tabela com seleção múltipla, busca por nome/CPF, filtro por status
- "Enviar lista" → validação de servidor (ficha assinada? lote aberto? registro não bloqueado?) → resumo com valor total → confirmação
- Criação da submissão com `unit_price` congelado → PIX gerado → **QR Code e copia-e-cola na tela na hora**
- Registros → `enviado`, `is_locked = true`
- Tela de acompanhamento do PIX com contador de expiração
- Fallback: anexar comprovante manual (JPG/PNG/PDF) se pagou por fora

**Financeiro** — cards (total enviado, aprovado, pendente, nomes processados) · submissões com status e valores · **extrato de movimentações** (a referência não tem) · progresso rumo à próxima meta de bônus.

**Histórico** — todos os registros, todas as ações coletivas. Busca por nome/CPF, filtros por lote, status e período, ordenação, paginação, **exportação Excel**.

**Reprotocolo** — registros elegíveis, com indicação clara de gratuito (≤30 dias) ou valor a pagar, e o preço calculado na tela.

**Contestações** — abrir (bloqueado até 72h após conclusão do lote), acompanhar, ver SLA restante.

**Perfil** — dados, **busca de endereço por CEP**, CPF/CNPJ (usado para gerar a cobrança PIX), datas de cadastro e atualização.

**Manual embutido** — passo a passo e dicionário dos oito status dentro do produto. A referência acerta nisso e vale replicar o padrão.

## 4.2 Console administrativo (`admin.*`)

Organize em **três superfícies, nesta ordem de prioridade: Operação (filas) → Registros (consulta e exceção) → Controle (configuração)**. O admin não é um CRUD; é um conjunto de filas com prazo. O erro clássico é construir a camada de Registros primeiro porque é a que se gera sozinha a partir do schema, e nunca chegar na de Operação. Não cometa esse erro.

**Painel do dia** — não é dashboard de métricas, é lista do que precisa de atenção: comprovantes na fila (com idade do mais antigo) · contestações abertas e quantas fora do SLA · retornos a processar · lote vigente com o número que importa (**quantos registros estão pagos e prontos**) · sinais anômalos (parceiro com 2+ reprovações no lote, submissão sem pagamento há 48h, CPFs duplicados). Todo número é clicável e leva às linhas que o compõem.

**Fila de conciliação** — a tela de maior alavancagem do sistema. Com o webhook funcionando, o caminho feliz é automático e esta fila **só recebe exceção**: valor divergente, PIX pago após expirar, pagamento sem submissão identificada, comprovante manual, webhook ausente após X horas.
Layout de duas colunas: fila compacta à esquerda (parceiro, valor esperado vs. identificado, qtd, tempo de espera, motivo); item ativo à direita com **o comprovante em visualizador grande** (60% da tela), valor esperado vs. valor no comprovante com a divergência destacada, contexto do parceiro (histórico curto), registros da submissão com **CPFs mascarados**.
Ações por teclado: `A` aprovar, `R` reprovar, pular. Reprovar exige `reason_code` de lista fechada (`valor_divergente`, `comprovante_ilegivel`, `comprovante_duplicado`, `pagamento_nao_localizado`, `dados_nao_conferem`) + observação — e **o motivo vai literalmente para o parceiro**. Aprovação em massa permitida só quando o valor bate exato, com preview (I3).
**Meta de design: um operador processa a fila sem tirar as mãos do teclado.** A diferença entre 8 e 40 segundos por item é a diferença entre uma pessoa e três.

**Console do lote** — uma tela por lote, que o acompanha do rascunho à conclusão, com stepper do ciclo de vida e abas:
- *Configuração* — nome, número, abertura, `closes_at`, `deadline_time`, preço por nome, birôs. Campos travam progressivamente; preço vira somente-leitura no instante do encerramento.
- *Composição* — registros com filtros por status, parceiro e pagamento. Colunas: parceiro · nome (mascarado) · documento (mascarado) · status · pago? · **ficha assinada?** · origem. A coluna de ficha é essencial: é o consentimento LGPD.
- *Financeiro do lote* — submissões, conciliado vs. pendente, e quantos registros estão prontos para seguir.
- *Encerramento* — **checklist com gates, não botão.** Modelo:
```
Encerrar AÇÃO COLETIVA 125
  ✅ 312 registros pagos e conciliados      → seguem
  ⚠️  18 enviados sem pagamento             → [ ] mover p/ próximo lote  [ ] cancelar
  ⚠️   7 sem ficha assinada                 → [ ] excluir  [ ] seguir (exige justificativa)
  ⚠️   3 comprovantes na fila               → resolver antes  [Ir para conciliação]
  ℹ️   4 CPFs duplicados                    → [revisar]
  ────────────────────────────────────────
  Ao encerrar: 312 registros congelados, protocolo individual gerado,
  parceiros notificados, lote 126 aberto automaticamente.
  [ Encerrar lote ]   ← exige digitar o nome do lote para confirmar
```
- *Protocolo* — gerar pacote, registrar referência devolvida, anexar comprovante de protocolo. Ao registrar, todos os registros vão a `protocolado` de uma vez, cada um com seu `ProcessEvent`.
- *Retorno* — importação do arquivo de retorno (ver 4.4).
- *Histórico* — timeline de tudo que aconteceu com o lote.

**Registros** — busca global, ficha individual com **timeline completa** (o `ProcessEvent` paga a si mesmo aqui), documentos, ações de exceção com motivo.

**Contestações** — fila com SLA cronometrado (verde/âmbar/vermelho). Detalhe com timeline do registro e histórico de contestações do mesmo CPF. Ações: responder · **encaminhar para reprotocolo** (cria o reprotocolo sem custo, vinculado ao ticket) · resolver · rejeitar com motivo.

**Ficha do parceiro** — seis abas: Cadastro · Comercial (override de preço **com justificativa**, assinatura, bônus concedido e consumido) · Atividade (registros por lote, taxa de baixa) · Financeiro · Documentos · Histórico de tudo que o admin fez nesse parceiro.
Ações: **"Ver como parceiro"** (impersonação com **banner permanente na tela, sessão com prazo, escrita bloqueada por padrão e registro em auditoria**) · suspender acesso · ajustar preço · conceder bônus · estender assinatura. Todas com motivo obrigatório.

**Financeiro** — visão consolidada, ledger, ajustes com `reason_code`, assinaturas, bônus.

**Controle** — preços e tabelas · conteúdo · templates de notificação · **feature flags** · usuários e papéis.

**Auditoria** — log imutável com **diff antes/depois** em cada linha, filtrável por ator, entidade, ação e período, exportável.

**Console LGPD** — busca do titular em toda a base · relatório do que existe sobre ele · exportação dos dados · eliminação com anonimização **preservando o registro contábil** · log de todos os pedidos atendidos.

**Papéis e separação de funções** — quem concilia pagamento **não pode** alterar preço; quem atende cliente **não pode** mudar status; quem opera lote **não pode** aprovar pagamento.

| Papel | Faz | Não faz |
|---|---|---|
| conciliador | fila de conciliação, aprovar/reprovar | ledger completo, preços, revelar CPF |
| operador | lotes, encerramento, protocolo, baixa em massa | aprovar pagamento, preços, usuários |
| suporte | contestações, consultar registros, impersonar em leitura | qualquer escrita financeira ou de status |
| financeiro | ledger, assinaturas, bônus, ajustes, relatórios | mudar status de processo, encerrar lote |
| administrador | tudo, incluindo configuração e usuários | — |

## 4.3 Consulta pública (`consulta.*`)

Campos CPF/CNPJ + número do protocolo → **timeline do processo**, não apenas o status atual. Sem login. Rate limiting obrigatório. Página de verificação de comprovante por hash (o QR Code do PDF aponta para cá).

## 4.4 Esteira com o escritório externo

O escritório **não acessa a plataforma**. A fronteira é arquivo entrando e saindo — isso mantém o escopo de dados pessoais controlado e evita gerir acesso de terceiro.

**Saída (pacote do lote):** planilha de registros em formato configurável por birô · fichas assinadas em zip · relatório de conferência (contagem, valores, checksum) · registro em `pacotes_lote` com quem gerou e quando.

**Entrada (arquivo de retorno):** upload → **mapeamento de colunas na tela** (cada birô manda formato diferente — não presuma) → matching por CPF/CNPJ + lote → **preview de diff obrigatório**:
```
Arquivo: retorno_serasa_ac124.csv — 312 linhas
  ✅ 287 baixados        → protocolado ➜ baixado
  ⚠️  19 não localizados → permanecem protocolado   [ver lista]
  ❌   4 recusados       → protocolado ➜ recusado + motivo do birô
  ❓   2 CPF fora deste lote                        [ver linhas]
  [ Aplicar 291 alterações ]  [ Baixar relatório ]  [ Cancelar ]
```
Aplicar → 291 `ProcessEvent` → notificações → **comprovantes em PDF emitidos**. O arquivo original fica anexado ao lote como evidência. **Nunca** exista um caminho que mude status em massa sem passar por esse preview.

**Protocolo e comprovante:** `protocol_code` individual por registro. Comprovante em PDF com QR Code de verificação apontando para a página pública de validação por hash.

## 4.5 PIX automático — o fluxo completo

```
Parceiro seleciona 8 registros → "Enviar lista"
  ↓ servidor valida: ficha assinada? lote aberto? não bloqueado?
Cria submissão (8 registros, unit_price congelado, valor_total calculado)
  ↓ PixProvider.criarCobranca()
QR Code + copia-e-cola na tela · registros → enviado, is_locked = true
  ↓ parceiro paga no app do banco
══════ WEBHOOK DO PSP ══════
  ↓ valida assinatura → idempotência por evento_id → confere valor
submissão → pago · 8 registros → pago · 8 ProcessEvent
  ↓ lançamento no ledger
  ↓ notifica parceiro + os 8 associados
registros → aguardando_protocolo   (automático)
```
**Zero intervenção humana no caminho feliz.** Mais: um **job de reconciliação ativa** consulta o PSP para cobranças sem webhook após X horas e resolve sozinho. A fila de conciliação existe só para o que sobrou.

## 4.6 WhatsApp e o agente de IA

**A restrição que organiza o desenho:** a API oficial trata de forma diferente mensagem iniciada por nós (exige **template pré-aprovado pela Meta**, texto fixo com variáveis) e mensagem iniciada pelo usuário (abre **janela de 24h** em que podemos responder **texto livre**, inclusive gerado por IA).

Implemente **envio de template e envio de texto livre como caminhos separados no código**, com controle da janela de 24h por conversa: texto livre só é permitido com janela aberta; se estiver fechada, o sistema **deve** cair para template. Torne isso impossível de errar — não deixe a decisão para quem chama.

O padrão que junta os dois:
```
Template aprovado: "ABDCM: sua solicitação {{1}} mudou para {{2}}.
                    Responda esta mensagem para ver os detalhes."
        ↓ associado responde qualquer coisa → janela de 24h abre
Agente de IA responde em texto livre, com contexto completo
```

**Matriz de notificação** (T = template, requer aprovação da Meta):

| Evento | Parceiro | Associado |
|---|---|---|
| Ficha enviada para assinatura | in-app | **T** |
| Ficha assinada | in-app | confirmação |
| Lote encerra em 24h | **T** + email | — |
| PIX gerado | in-app | — |
| PIX expirando em 15min | **T** | — |
| Pagamento confirmado | **T** | **T** |
| Protocolado | in-app | **T** + protocolo |
| Baixado | **T** | **T** + comprovante PDF |
| Recusado pelo birô | **T** | — |
| Contestação respondida | **T** + in-app | — |

São ~8 templates. Versione-os em código, com variáveis tipadas. Fila com retry e backoff; falha de entrega é **registrada, nunca silenciosa**. Fallback por email quando o WhatsApp não estiver disponível.

**O agente de IA** — não é um LLM solto com acesso ao banco. É um agente com **ferramentas estreitas**, todas já escopadas pelo remetente (I7):
```
consultarMinhasSolicitacoes()          → registros do associado
consultarStatusDetalhado(registroId)   → valida propriedade antes de responder
consultarProximoLote()
consultarPendencias()                  → ficha não assinada, pagamento pendente
abrirAtendimentoHumano(motivo)         → escala e encerra o bot
```
Resolução de identidade por telefone **antes** de qualquer ferramenta rodar. Número desconhecido recebe: *"Não localizei um cadastro com este número. Fale com o parceiro que fez sua filiação ou consulte em consulta.abdcm.* com seu CPF e protocolo."* — sem revelar nada, nem a existência do CPF.

Caso especial: parceiro cadastrado consultando sobre seus associados → escopo dos próprios associados, nunca da base inteira.

**Restrições duras no prompt do agente:** não prometer resultado · não dar orientação jurídica · não discutir valor, negociação ou reembolso (escala) · não confirmar nem negar cadastro para número desconhecido · **não inventar prazo** (só os configurados no sistema) · em dúvida, escalar em vez de improvisar.

Persista toda conversa com as ferramentas chamadas — serve para auditoria, para medir taxa de escalação e para melhorar o prompt com dado real.

---

# PARTE 5 — ORDEM DE EXECUÇÃO

Construa nesta ordem. Cada fase entrega algo que funciona sozinho — nunca me deixe em "80% pronto", que é o estado onde projetos morrem.

**FASE 0 — Fundação**
`CLAUDE.md` do projeto (ver Parte 6) · scaffold (Next + TS strict + Tailwind + Drizzle + Vitest + lint/format) · `.env.example` documentado · **schema completo em migrations SQL** (Parte 3) · Auth e os 6 papéis com as permissões de 4.2 · **máquina de estados como módulo de domínio puro, com testes de cada transição válida e cada proibida** · layout base dos três frontends.
*Pronto quando:* migrations rodam do zero, testes da máquina de estados passam, login funciona com os 6 papéis.

**FASE 1 — Núcleo operacional** ← *a ABDCM já opera um lote real de ponta a ponta*
Filiação com assinatura (mock) · cadastro individual e importação de planilha com preview/dedup/relatório · console do lote com **encerramento por gates** · envio de lista com bloqueio · **PIX automático + webhook + idempotência + reconciliação ativa** · fila de conciliação · painel do dia · histórico com filtros e exportação · consulta pública com timeline.
*Pronto quando:* dá para criar lote, filiar associado, enviar lista, pagar no mock, ver tudo avançar sozinho até `aguardando_protocolo`, e consultar no portal público.

**FASE 2 — Comunicação**
WhatsAppProvider com mock · controle da janela de 24h · os ~8 templates · motor de notificação por evento com fila, retry e fallback · **agente de IA com escopo por telefone** · central de notificações in-app.
*Pronto quando:* os testes de vazamento passam (ver Parte 7).

**FASE 3 — Esteira e ciclo completo**
Pacote do lote · registro de protocolo · **importação de retorno com preview de diff** · baixa em massa · `protocol_code` e comprovante PDF com QR verificável · reprotocolo com a regra de 30 dias · contestações com carência de 72h e SLA de 48h.
*Pronto quando:* um lote vai de aberto a concluído com baixa em massa a partir de arquivo.

**FASE 4 — Gestão e conformidade**
Ledger e extrato · premiação por volume · assinaturas dos parceiros · ficha do parceiro com impersonação rastreada · auditoria com diff · console LGPD · relatórios (taxa de baixa por birô, tempo médio por etapa, funil, faturamento, ranking).

**FASE 5 — Camada comercial (só se eu pedir)**
Calculadora de precificação · gerador de orçamento em PDF com a marca do parceiro · biblioteca de materiais · academia.

---

# PARTE 6 — COMO TRABALHAR COMIGO

**Antes de qualquer código:** escreva o `CLAUDE.md` do projeto contendo o parágrafo de domínio, **os 11 invariantes na íntegra**, os oito status, a stack, as convenções de nome, as integrações com adaptador e a estrutura de pastas. Escreva-o para que uma sessão futura sem nenhum contexto consiga trabalhar só com ele. Este arquivo é a memória do projeto.

**Depois:** me apresente o plano da Fase 0 e espere meu OK.

**Durante:**
- Incrementos pequenos e verificáveis. Rode os testes **antes** de dizer que algo está pronto.
- Se uma decisão não estiver aqui e for relevante, **pergunte** em vez de presumir. Presumir errado custa semanas.
- Se discordar de algo nesta especificação, diga **antes** de implementar diferente.
- Não gere código de fases futuras. Termine a fase, pare, e espere revisão.
- Commits e documentação em português.
- Ao fim de cada fase: resumo do que foi feito, o que ficou de fora, e o que eu preciso decidir para a próxima.

**Nunca:**
- coloque credencial em arquivo
- implemente coleta de senha de terceiro (pare e pergunte — I8)
- crie caminho que mude status sem `ProcessEvent`
- crie operação em massa sem preview
- deixe o frontend falar com o banco direto

---

# PARTE 7 — TESTES OBRIGATÓRIOS

Estes não são opcionais e não entram como "depois". Um teste que falha aqui é bug de produção esperando acontecer.

**Domínio**
- cada transição válida da máquina de estados funciona
- **cada transição proibida falha** com erro de domínio
- `unit_price` congela no envio e não muda depois
- precedência de preço resolve na ordem correta
- reprotocolo: grátis em D+29, cobrado em D+31
- gates de encerramento bloqueiam quando devem
- contestação recusada antes de 72h da conclusão

**Integração**
- webhook duplicado (mesmo `evento_id`) **não** processa duas vezes
- webhook fora de ordem não regride status
- PIX expirado e pago depois cai na fila de exceção, não em `pago`
- valor divergente não confirma automaticamente
- reconciliação ativa resolve cobrança sem webhook

**Segurança e privacidade — os mais importantes do projeto**
- **número não cadastrado não recebe informação sobre nenhum CPF**, por nenhum caminho
- **remetente A não alcança dados do associado B**, por nenhum caminho, incluindo tentativa de passar CPF ou id na mensagem
- parceiro A não vê dados do parceiro B (isolamento por `partner_id`)
- consulta entre tenants é impossível (isolamento por `tenant_id`)
- texto livre bloqueado com janela de 24h fechada
- cada papel só executa o que lhe cabe (teste por papel, por rota)
- CPF vem mascarado por padrão nas respostas do admin
- revelação de CPF gera registro em auditoria

**Importação**
- duplicidade detectada no arquivo e contra o histórico
- CPF inválido rejeitado com a linha identificada
- planilha malformada não quebra a importação inteira
- preview não escreve nada no banco

---

# PARTE 8 — RELEMBRANDO O QUE MAIS IMPORTA

Você acabou de ler uma especificação longa. Se lembrar de só cinco coisas, que sejam estas:

1. **Nada de regra de negócio no cliente, e o navegador nunca fala com o banco.** É a causa raiz de todos os problemas do sistema que estamos superando.
2. **Toda mudança de status grava `ProcessEvent`.** Garantido por estrutura, não por disciplina.
3. **Nenhuma operação em massa sem preview de diff.**
4. **O bot só fala do que pertence a quem está falando** — resolução por telefone, ferramentas que não aceitam CPF como busca, número desconhecido não recebe nada.
5. **Nunca credencial de terceiro, nunca segredo em arquivo.** Se um requisito parecer exigir, pare e me pergunte.

Este sistema movimenta dinheiro de uma associação e processa CPF de terceiros. Bug aqui é incidente de LGPD ou dinheiro no lugar errado — não botão desalinhado. Prefira a implementação correta e um pouco mais lenta.

**Comece escrevendo o `CLAUDE.md` e me apresentando o plano da Fase 0.**
