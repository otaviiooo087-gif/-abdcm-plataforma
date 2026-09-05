// Utilitario de Mascaramento LGPD para CPF e CNPJ
// Invariante I6: CPF/CNPJ mascarado por padrao em toda tela administrativa.
// Formato padrao: 123.***.**9-00 (CPF) ou 12.***.***/0001-90 (CNPJ)

export function cleanDocument(raw: string): string {
  return (raw || '').replace(/\D/g, '');
}

export function maskDocument(raw: string): string {
  const digits = cleanDocument(raw);

  if (digits.length === 11) {
    // CPF: 123.***.**9-00
    const p1 = digits.substring(0, 3);
    const p2 = '***';
    const p3 = '**' + digits.substring(8, 9);
    const p4 = digits.substring(9, 11);
    return `${p1}.${p2}.${p3}-${p4}`;
  }

  if (digits.length === 14) {
    // CNPJ: 12.***.***/0001-90
    const p1 = digits.substring(0, 2);
    const p2 = '***';
    const p3 = '***';
    const p4 = digits.substring(8, 12);
    const p5 = digits.substring(12, 14);
    return `${p1}.${p2}.${p3}/${p4}-${p5}`;
  }

  return '***.***.***-**';
}

export function formatDocumentFull(raw: string): string {
  const digits = cleanDocument(raw);
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return raw;
}
