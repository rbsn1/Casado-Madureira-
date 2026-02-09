type CpfParseResult = {
  digits: string;
  formatted: string;
};

function stripToDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCpfInput(rawValue: string) {
  const digits = stripToDigits(rawValue).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function isRepeatedDigits(value: string) {
  return /^(\d)\1+$/.test(value);
}

export function isValidCpf(rawValue: string) {
  const cpf = stripToDigits(rawValue);
  if (cpf.length !== 11 || isRepeatedDigits(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(cpf[i]) * (10 - i);
  }
  let firstDigit = (sum * 10) % 11;
  if (firstDigit === 10) firstDigit = 0;
  if (firstDigit !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number(cpf[i]) * (11 - i);
  }
  let secondDigit = (sum * 10) % 11;
  if (secondDigit === 10) secondDigit = 0;
  return secondDigit === Number(cpf[10]);
}

export function parseCpf(rawValue: string): CpfParseResult | null {
  const digits = stripToDigits(rawValue);
  if (!isValidCpf(digits)) return null;
  return {
    digits,
    formatted: formatCpfInput(digits)
  };
}
