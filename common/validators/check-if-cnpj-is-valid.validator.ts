export function isValidCNPJ(cnpj: string | number): { isValid: boolean; cleanCnpj: string } {
  const cleanCnpj = cnpj.toString().replace(/[^\d]+/g, '');

  if (cleanCnpj.length !== 14) {
    return { isValid: false, cleanCnpj };
  }

  // Elimina CNPJs com todos os dígitos iguais
  if (/^(\d)\1{13}$/.test(cleanCnpj)) {
    return { isValid: false, cleanCnpj };
  }

  const calcCheckDigit = (cnpj: string, length: number): number => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    const sum = cnpj
      .slice(0, length)
      .split('')
      .reduce((acc, digit, index) => acc + parseInt(digit) * weights[index], 0);

    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const digit1 = calcCheckDigit(cleanCnpj, 12);
  const digit2 = calcCheckDigit(cleanCnpj, 13);

  const isValid =
    digit1 === parseInt(cleanCnpj.charAt(12)) && digit2 === parseInt(cleanCnpj.charAt(13));

  return {
    isValid,
    cleanCnpj,
  };
}
