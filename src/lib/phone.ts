type PhoneParseResult = {
  digits: string;
  formatted: string;
};

function stripToDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatBrazilPhoneInput(rawValue: string) {
  const digits = stripToDigits(rawValue).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 5) {
    return `(${ddd}) ${rest}`;
  }
  if (rest.length <= 9) {
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`;
}

function formatWithDdd(digits: string) {
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length === 9) {
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

export function parseBrazilPhone(rawValue: string): PhoneParseResult | null {
  if (!rawValue) return null;
  let digits = stripToDigits(rawValue);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  if (digits.length !== 10 && digits.length !== 11) return null;
  return {
    digits,
    formatted: formatWithDdd(digits)
  };
}
