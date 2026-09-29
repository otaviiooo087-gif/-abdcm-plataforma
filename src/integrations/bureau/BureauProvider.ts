// Interface do provedor de consulta de birô de crédito (Serasa). Nenhum SDK
// de terceiro deve vazar pra fora de src/integrations/bureau — o resto do
// sistema só conhece este contrato (mesma doutrina de PIX/WhatsApp/OCR/
// Monitoramento, CLAUDE.md seção 8).
//
// Diferente do monitoramento processual (que abre um acompanhamento e
// recebe webhook), o birô é só consulta pontual read-only: pra cada
// registro protocolado, periodicamente perguntamos "a restrição desse CPF
// no Serasa ainda está ativa?" — se não estiver mais, é a baixa chegando
// mais cedo que o arquivo de retorno manual do escritório jurídico (30-90
// dias). Nunca decide nada sozinho além disso: quem transiciona o registro
// pra "baixado" continua sendo marcarOrgaoBaixado() (I2 — ProcessEvent),
// exatamente como a baixa manual ou a importação de retorno.
//
// I8 — não coleta nenhuma credencial de terceiro: a consulta usa as
// credenciais da própria ABDCM/escritório parceiro junto ao Serasa, nunca
// senha do associado.

export interface ConsultarStatusBureauInput {
  /** CPF ou CNPJ sem máscara, só dígitos. */
  cpfCnpj: string;
}

export interface StatusBureau {
  /** true = ainda consta restrição ativa; false = não consta mais (baixa). */
  restricaoAtiva: boolean;
  /** Texto livre do provedor, quando disponível, só pra leitura humana. */
  detalhes?: string | null;
}

export interface BureauProvider {
  consultarStatus(input: ConsultarStatusBureauInput): Promise<StatusBureau>;
}
