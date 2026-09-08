/**
 * Emissão do "nada consta" — a consulta que comprova que um nome está
 * limpo depois que todos os órgãos (Serasa, Boa Vista, SPC, Cenprot BR,
 * Cenprot SP) deram baixa. Nenhum birô oferece hoje uma API pública
 * contratada pela ABDCM pra isso — só existe o provedor mock por
 * enquanto (I8/seção 8 do CLAUDE.md: nunca se conecta em conta externa
 * sem que ela exista de verdade). Quando um birô real for contratado,
 * a interface já está pronta pra receber um provider de verdade.
 */
export interface NadaConstaProvider {
  emitir(input: {
    nome: string
    cpfCnpj: string
    registroId: string
  }): Promise<{
    protocoloConsulta: string
    documentoBase64: string
    mimeType: string
    emitidoEm: Date
  }>
}
