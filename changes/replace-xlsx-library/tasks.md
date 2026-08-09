# Tasks — Trocar xlsx por read-excel-file

- [x] Instalar `read-excel-file`, remover `xlsx` de `package.json`
- [x] Reescrever `parseImportFile` em `cadastrosImport.ts` usando `readSheet`
      de `read-excel-file/browser` (o export default `readXlsxFile` na v9
      devolve todas as planilhas agrupadas; `readSheet` é o equivalente
      direto ao comportamento antigo — primeira planilha, `Row[]`)
- [x] Adaptar `normalizeImportDate` para aceitar `Date` (célula de data
      nativa) e `number` (serial cru, com a fórmula de época do Excel
      `Date.UTC(1899,11,30) + serial * 86400000`), além dos formatos de
      string já suportados
- [x] Testado com planilha `.xlsx` real gerada via `exceljs` (célula de
      data nativa, texto `dd/mm/aaaa`, serial numérico cru) — os três
      caminhos de `normalizeImportDate` bateram com o valor esperado depois
      de corrigir um erro de cálculo no próprio teste (não no código)
- [x] Rodar `npm run build` e `npm run lint` sem erros novos (bundle de
      `/cadastros` caiu de 150kB para 29kB)
- [x] Rodar `npm audit` de novo e confirmar que as CVEs do `xlsx` somem
      (confirmado — `read-excel-file` não aparece no audit)
