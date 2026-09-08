-- "Contrato Limpa Nome" vira "Contratos e Documentos Complementares": em
-- vez de um único contrato-modelo, o admin anexa quantos documentos quiser
-- (ficha associativa modelo, contrato de intermediação etc), cada um com
-- um título. A coluna titulo tem default pra não quebrar a linha única que
-- já existia (id fixo 'contrato-modelo', ver store.ts).
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS titulo TEXT NOT NULL DEFAULT 'Contrato Limpa Nome';
