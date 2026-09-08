// Geração automática da Ficha Associativa (Termo de Autorização e
// Representação) a partir de um documento de identidade (RG/CNH) já lido
// pelo OCR (src/integrations/ocr). Roda inteiramente no servidor — o
// navegador nunca monta PDF nem fala com o provedor de OCR direto (I1).
//
// Importante sobre a assinatura: o retângulo recortado da foto do documento
// é só uma cópia visual, colada na ficha pra dar contexto — NUNCA é a prova
// de consentimento do associado (I5/I8). A prova real é o registro separado
// que quem chama gerarFichaAssociativaPdf grava depois, com data, IP e hash
// do PDF final (Associado.consentimento_em/consentimento_ip/consentimento_hash
// em src/server/store.ts). Se a extração não achar a assinatura, a ficha
// ainda é gerada normalmente — o campo fica em branco, sem bloquear nada.

import { PDFDocument, PageSizes, StandardFonts, rgb, clip, endPath, rectangle, pushGraphicsState, popGraphicsState } from 'pdf-lib';

export interface DadosFichaAssociativa {
  nome: string;
  /** CPF/CNPJ já formatado (com máscara ou não — impresso como veio). */
  cpf: string;
  /** Bytes do documento original (RG/CNH) enviado pelo parceiro. */
  documentoBytes: ArrayBuffer;
  documentoMimeType: string;
  /** [ymin, xmin, ymax, xmax] normalizado 0-1000, ou null se o OCR não achou assinatura. */
  assinaturaCoords: [number, number, number, number] | null;
}

const TERMO_CORPO = [
  'O Associado, por meio desta filiação à ABDCM (Associação Brasileira de Defesa do Consumidor ' +
    'e do Cidadão Mineiro), autoriza a entidade a atuar em seu nome, em qualquer juízo, instância ' +
    'ou tribunal, em todo o território nacional.',
  'A entidade poderá propor as ações cabíveis contra terceiros, bem como defender o associado em ' +
    'ações contrárias, acompanhando-as até decisão final, inclusive utilizando todos os recursos ' +
    'legais disponíveis.',
  'Confere-se à entidade poderes especiais para:',
  '   •  Reconhecer a procedência de pedidos;',
  '   •  Desistir de ações;',
  '   •  Renunciar direitos;',
  '   •  Transigir, agindo em juízo ou fora dele, exclusivamente na defesa dos direitos do consumidor.',
  'Além disso, o associado autoriza expressamente a entidade a atuar como substituta processual ' +
    'nas ações judiciais propostas.',
  'Nos termos da Lei Geral de Proteção de Dados Pessoais (LGPD, Lei nº 13.709/2018), que visa ' +
    'proteger os direitos fundamentais de liberdade, privacidade e livre formação da personalidade, ' +
    'o associado declara:',
  '1. Autorizar, por prazo indeterminado e de forma irretratável, a entidade e seus representantes ' +
    'a compartilhar suas informações pessoais entre si ou com terceiros, sempre em conformidade com ' +
    'os objetivos de defesa dos direitos do consumidor.',
  '2. Reconhecer que esta autorização está em conformidade com os artigos 43 e 83 do Código de ' +
    'Defesa do Consumidor (CDC).',
];

function quebrarLinhas(texto: string, font: import('pdf-lib').PDFFont, tamanho: number, larguraMax: number): string[] {
  const palavras = texto.split(' ');
  const linhas: string[] = [];
  let atual = '';
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (font.widthOfTextAtSize(tentativa, tamanho) > larguraMax && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** Desenha a cópia visual da assinatura (recortada da foto do documento) no
 * retângulo de destino, sem distorcer a página inteira — recorta via
 * clipping, já que pdf-lib não tem um "desenhar sub-retângulo da imagem"
 * pronto. Falha silenciosamente (sem assinatura na ficha) se algo der
 * errado — nunca derruba a geração do PDF por causa de um recorte visual. */
function desenharAssinaturaRecortada(
  page: import('pdf-lib').PDFPage,
  imagem: import('pdf-lib').PDFImage,
  coords: [number, number, number, number],
  destino: { x: number; y: number; width: number; height: number },
): void {
  const [ymin, xmin, ymax, xmax] = coords;
  const fXmin = xmin / 1000;
  const fXmax = xmax / 1000;
  const fYmin = ymin / 1000;
  const fYmax = ymax / 1000;
  const fracW = fXmax - fXmin;
  const fracH = fYmax - fYmin;
  if (fracW <= 0.005 || fracH <= 0.005) return; // retângulo degenerado — ignora

  const fullDrawW = destino.width / fracW;
  const fullDrawH = destino.height / fracH;
  const imgX = destino.x - fXmin * fullDrawW;
  const imgY = destino.y - fullDrawH * (1 - fYmax);

  page.pushOperators(
    pushGraphicsState(),
    rectangle(destino.x, destino.y, destino.width, destino.height),
    clip(),
    endPath(),
  );
  page.drawImage(imagem, { x: imgX, y: imgY, width: fullDrawW, height: fullDrawH });
  page.pushOperators(popGraphicsState());
}

/** Gera o PDF unificado: página do termo preenchido (com a assinatura
 * recortada da foto, quando encontrada) seguida do documento original
 * anexado (imagem ou PDF, cada página redimensionada pra caber em A4). */
export async function gerarFichaAssociativaPdf(dados: DadosFichaAssociativa): Promise<Uint8Array> {
  const finalPdf = await PDFDocument.create();
  const fontRegular = await finalPdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await finalPdf.embedFont(StandardFonts.HelveticaBold);

  const [largura, altura] = PageSizes.A4;
  const margem = 50;
  const larguraMax = largura - margem * 2;
  const page = finalPdf.addPage(PageSizes.A4);

  const azul = rgb(0.11, 0.31, 0.85);
  const preto = rgb(0.06, 0.09, 0.16);

  const titulo = 'TERMO DE AUTORIZAÇÃO E REPRESENTAÇÃO';
  const tituloTamanho = 14;
  const tituloLargura = fontBold.widthOfTextAtSize(titulo, tituloTamanho);
  let cursorY = altura - 70;
  page.drawText(titulo, { x: (largura - tituloLargura) / 2, y: cursorY, size: tituloTamanho, font: fontBold, color: azul });
  page.drawLine({
    start: { x: (largura - tituloLargura) / 2, y: cursorY - 4 },
    end: { x: (largura + tituloLargura) / 2, y: cursorY - 4 },
    thickness: 1,
    color: azul,
  });

  cursorY -= 35;
  page.drawText('NOME/RAZÃO SOCIAL:', { x: margem, y: cursorY, size: 11, font: fontBold, color: preto });
  page.drawText(dados.nome, { x: margem + 145, y: cursorY, size: 11, font: fontRegular, color: preto });

  cursorY -= 20;
  page.drawText('CPF/CNPJ:', { x: margem, y: cursorY, size: 11, font: fontBold, color: preto });
  page.drawText(dados.cpf, { x: margem + 145, y: cursorY, size: 11, font: fontRegular, color: preto });

  cursorY -= 30;
  const corpoTamanho = 10;
  const alturaLinha = 13.5;
  for (const paragrafo of TERMO_CORPO) {
    const linhas = quebrarLinhas(paragrafo, fontRegular, corpoTamanho, larguraMax);
    for (const linha of linhas) {
      if (cursorY < 130) break; // não deixa o corpo invadir o bloco de assinatura
      page.drawText(linha, { x: margem, y: cursorY, size: corpoTamanho, font: fontRegular, color: preto });
      cursorY -= alturaLinha;
    }
    cursorY -= 6;
  }

  // Bloco de assinatura
  const linhaAssinaturaY = 90;
  const assinaturaDestino = { x: (largura - 160) / 2, y: linhaAssinaturaY + 4, width: 160, height: 40 };

  // pdf-lib só sabe embutir JPG e PNG nativamente (webp/gif não são
  // suportados) — nesses casos a ficha ainda é gerada, só sem a cópia visual
  // da assinatura nem o anexo do documento original (ver bloco abaixo).
  const ehImagemAssinavel =
    dados.assinaturaCoords && ['image/jpeg', 'image/png'].includes(dados.documentoMimeType);
  if (ehImagemAssinavel) {
    try {
      const imagem =
        dados.documentoMimeType === 'image/png'
          ? await finalPdf.embedPng(dados.documentoBytes)
          : await finalPdf.embedJpg(dados.documentoBytes);
      desenharAssinaturaRecortada(page, imagem, dados.assinaturaCoords!, assinaturaDestino);
    } catch (err) {
      console.warn('[gerarFichaAssociativaPdf] falha ao recortar assinatura, ficha segue sem ela:', err);
    }
  }

  page.drawLine({
    start: { x: margem + 60, y: linhaAssinaturaY },
    end: { x: largura - margem - 60, y: linhaAssinaturaY },
    thickness: 1,
    color: preto,
  });
  const rotuloAssinatura = 'ASSINATURA';
  const rotuloLargura = fontBold.widthOfTextAtSize(rotuloAssinatura, 9);
  page.drawText(rotuloAssinatura, { x: (largura - rotuloLargura) / 2, y: linhaAssinaturaY - 14, size: 9, font: fontBold, color: preto });

  // Anexa o documento original (imagem ou PDF) como página(s) seguinte(s).
  const margemAnexo = 20;
  if (dados.documentoMimeType === 'application/pdf') {
    const origem = await PDFDocument.load(dados.documentoBytes);
    for (const paginaOrigem of origem.getPages()) {
      const { width: origW, height: origH } = paginaOrigem.getSize();
      const novaPagina = finalPdf.addPage(PageSizes.A4);
      const [embutida] = await finalPdf.embedPages([paginaOrigem]);
      const escala = Math.min((largura - margemAnexo * 2) / origW, (altura - margemAnexo * 2) / origH);
      const finalW = origW * escala;
      const finalH = origH * escala;
      novaPagina.drawPage(embutida, { x: (largura - finalW) / 2, y: (altura - finalH) / 2, width: finalW, height: finalH });
    }
  } else if (['image/jpeg', 'image/png'].includes(dados.documentoMimeType)) {
    const imagem =
      dados.documentoMimeType === 'image/png'
        ? await finalPdf.embedPng(dados.documentoBytes)
        : await finalPdf.embedJpg(dados.documentoBytes);
    const novaPagina = finalPdf.addPage(PageSizes.A4);
    const escala = Math.min((largura - margemAnexo * 2) / imagem.width, (altura - margemAnexo * 2) / imagem.height);
    const finalW = imagem.width * escala;
    const finalH = imagem.height * escala;
    novaPagina.drawImage(imagem, { x: (largura - finalW) / 2, y: (altura - finalH) / 2, width: finalW, height: finalH });
  }

  return finalPdf.save();
}
