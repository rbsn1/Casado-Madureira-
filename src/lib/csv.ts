type CsvValue = string | number | boolean | null | undefined;

function escapeCsvValue(value: CsvValue) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (text.includes('"') || text.includes(",") || text.includes("\n") || text.includes("\r") || text.includes(";")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: CsvValue[][]) {
  const head = headers.map(escapeCsvValue).join(",");
  const body = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  return [head, body].join("\n");
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: CsvValue[][],
  options: { withBom?: boolean } = {}
) {
  const csv = toCsv(headers, rows);
  const payload = options.withBom ? `\uFEFF${csv}` : csv;
  const blob = new Blob([payload], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function detectDelimiter(line: string) {
  const commaCount = (line.match(/,/g) ?? []).length;
  const semiCount = (line.match(/;/g) ?? []).length;
  return semiCount > commaCount ? ";" : ",";
}

function parseCsvLine(line: string, delimiter: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i += 1;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
      i += 1;
      continue;
    }
    current += char;
    i += 1;
  }
  result.push(current.trim());
  return result;
}

export function parseCsv(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] as string[][] };
  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter);
  const rows = lines.slice(1).map((line) => parseCsvLine(line, delimiter));
  return { headers, rows };
}
