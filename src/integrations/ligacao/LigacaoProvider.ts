// Interface do provedor de ligação automática (CLAUDE.md seção 8). Nenhum
// provedor real de telefonia/IVR (Twilio Voice, Zenvia Voz etc.) está
// contratado — só existe o Mock, que simula a chamada e sua ramificação
// sim/não pra viabilizar o desenho da automação sem custo nem conta externa.

export interface RoteiroLigacao {
  abertura: string;
  respostaSim: string;
  respostaNao: string;
}

export interface LigarInput {
  telefone: string;
  roteiro: RoteiroLigacao;
}

export type ResultadoLigacao = 'sim' | 'nao' | 'sem_resposta';

export interface RegistroLigacao {
  callId: string;
  resultado: ResultadoLigacao;
  transcricao: string;
}

export interface LigacaoProvider {
  ligar(input: LigarInput): Promise<RegistroLigacao>;
}
