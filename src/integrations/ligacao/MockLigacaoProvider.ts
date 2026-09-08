import type { LigacaoProvider, LigarInput, RegistroLigacao, ResultadoLigacao } from './LigacaoProvider.js';

// Simula a ligação e a resposta da pessoa (sim/não/sem resposta) — não liga
// pra ninguém de verdade. Só registra um log/transcrição pra permitir
// desenhar e testar a automação de ligação antes de existir provedor real.
export class MockLigacaoProvider implements LigacaoProvider {
  async ligar(input: LigarInput): Promise<RegistroLigacao> {
    const callId = `mock_call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const sorteio = Math.random();
    const resultado: ResultadoLigacao = sorteio < 0.7 ? 'sim' : sorteio < 0.9 ? 'nao' : 'sem_resposta';

    const linhas = [`[MOCK] Ligando para ${input.telefone}...`, `ABDCM: "${input.roteiro.abertura}"`];
    if (resultado === 'sem_resposta') {
      linhas.push('(ninguém atendeu)');
    } else if (resultado === 'sim') {
      linhas.push('Pessoa: "Sim, pode contar comigo."');
      linhas.push(`ABDCM: "${input.roteiro.respostaSim}"`);
    } else {
      linhas.push('Pessoa: "Não, agora não vai dar."');
      linhas.push(`ABDCM: "${input.roteiro.respostaNao}"`);
    }
    const transcricao = linhas.join('\n');
    console.log(`[Ligação MOCK] ${input.telefone} -> ${resultado}`);

    return { callId, resultado, transcricao };
  }
}
