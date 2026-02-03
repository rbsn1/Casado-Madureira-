export function formatDateBR(value: Date | string | number | null | undefined) {
  if (!value) return "";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-");
      return `${day}/${month}/${year}`;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const [datePart] = value.split("T");
      if (datePart) {
        const [year, month, day] = datePart.split("-");
        return `${day}/${month}/${year}`;
      }
    }
    return `${day}/${month}/${year}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}
