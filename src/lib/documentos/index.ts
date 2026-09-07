// Quais documentos cada tipo de associado precisa anexar — CPF usa CNH/RG,
// CNJP não tem esses dois, usa o comprovante de inscrição no lugar. Ficha
// associativa vale pros dois. Compartilhado entre as telas que mostram
// status/visualização de documentos (Enviar Limpa Nome, Minhas Listas).

export interface StatusDocumentos {
  cnh: boolean;
  rg: boolean;
  comprovante_inscricao: boolean;
  ficha_associativa: boolean;
}

export function documentosEsperados(tipoDocumento: 'cpf' | 'cnpj'): { tipo: keyof StatusDocumentos; label: string }[] {
  return tipoDocumento === 'cnpj'
    ? [
        { tipo: 'comprovante_inscricao', label: 'Comprovante de Inscrição (CNPJ)' },
        { tipo: 'ficha_associativa', label: 'Ficha Associativa' },
      ]
    : [
        { tipo: 'cnh', label: 'CNH' },
        { tipo: 'rg', label: 'RG' },
        { tipo: 'ficha_associativa', label: 'Ficha Associativa' },
      ];
}
