import type { BureauProvider, ConsultarStatusBureauInput, StatusBureau } from './BureauProvider.js';

// Provedor de desenvolvimento: não fala com o Serasa de verdade — sempre
// responde "restrição ainda ativa", ou seja, nunca dá baixa sozinho. Isso é
// proposital: sem provedor real configurado, a baixa continua vindo só do
// jeito manual de sempre (admin marca órgão, ou importação de arquivo de
// retorno) — o mock nunca inventa uma baixa que não aconteceu de verdade.
export class MockBureauProvider implements BureauProvider {
  async consultarStatus(_input: ConsultarStatusBureauInput): Promise<StatusBureau> {
    void _input;
    return { restricaoAtiva: true, detalhes: null };
  }
}
