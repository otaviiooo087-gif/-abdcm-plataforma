-- Telefone deixa de ser obrigatório na criação do associado. Até aqui, um
-- associado só era criado de verdade quando havia telefone (cadastro
-- individual ou ficha) — importação por planilha (só Nome + CPF/CNPJ)
-- fabricava um id que não existia na tabela, então documentos (CNH/RG/ficha)
-- nunca conseguiam ser anexados a esses registros (FK de documentos_associado
-- exige um associado real). Agora todo registro cria um associado de
-- verdade; sem telefone, o bot de WhatsApp simplesmente não funciona pra essa
-- pessoa até alguém completar o cadastro (I7 já trata número não cadastrado
-- como "nenhuma informação" — mesma lógica seve pra telefone ausente).

alter table associados alter column telefone_whatsapp drop not null;
