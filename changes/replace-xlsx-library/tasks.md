# Tasks — Trocar xlsx por read-excel-file

- [ ] Instalar `read-excel-file`, remover `xlsx` de `package.json`
- [ ] Reescrever `parseImportFile` em `cadastrosImport.ts` usando `readXlsxFile`
- [ ] Adaptar `normalizeImportDate` para aceitar `Date` (célula de data
      nativa) além dos formatos de string já suportados
- [ ] Testar manualmente com uma planilha `.xlsx` real (linha com data em
      célula formatada como data, linha com data como texto `dd/mm/aaaa`,
      linha com telefone/nome) antes de considerar concluído
- [ ] Rodar `npm run build` e `npm run lint` sem erros novos
- [ ] Rodar `npm audit` de novo e confirmar que as CVEs do `xlsx` somem
