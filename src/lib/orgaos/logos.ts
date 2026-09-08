import { OrgaoBureau } from '../../domain/types.js';

// Logos reais dos birôs/cartórios (public/orgaos/) — servidos como
// arquivo estático pelo Vite/Express, mesmo caminho em toda a aplicação.
// cenprot_sp usa o logo dos Cartórios de Protesto SP (IEPTB-SP), que é
// quem de fato opera o protesto de títulos no estado de São Paulo.
export const ORGAO_LOGO_URL: Record<OrgaoBureau, string> = {
  serasa: '/orgaos/serasa.png',
  spc: '/orgaos/spc-brasil.png',
  boa_vista: '/orgaos/boa-vista.png',
  cenprot_br: '/orgaos/cenprot.png',
  cenprot_sp: '/orgaos/cartorios-protesto-sp.png',
};
