# Trocar `xlsx` por `read-excel-file`

## Why

`xlsx@0.18.5` tem 2 CVEs altas sem correção disponível da própria
biblioteca (prototype pollution GHSA-4r6h-8v6p-xvw6, ReDoS
GHSA-5pgg-2g8v-p4x9). É usada em `src/lib/cadastrosImport.ts` para o
import de planilhas `.xlsx` no fluxo de cadastro — ou seja, processa
arquivo enviado pelo usuário, o que torna o vetor real (não é uma
dependência só de build).

Pesquisei duas alternativas mantidas ativamente:

| Biblioteca | Vulnerabilidades | Peso | Uso no projeto |
|---|---|---|---|
| `exceljs@4.4.0` | 2 moderadas (via `uuid` transitivo, com fix disponível) | Maior — API completa de leitura/escrita/estilo | Muito mais do que precisamos (só lemos) |
| `read-excel-file@9.3.8` | Nenhuma encontrada | Menor, focada em leitura | Bate exatamente com o uso atual |

`read-excel-file` é a recomendação: zero vulnerabilidades encontradas,
biblioteca menor, e a API (`readXlsxFile(file) → Promise<Row[]>`) já
cobre exatamente o que `cadastrosImport.ts` faz hoje — ler a primeira
planilha e devolver linhas.

## What Changes

- Trocar dependência `xlsx` → `read-excel-file` em `package.json`.
- Em `src/lib/cadastrosImport.ts`, função `parseImportFile`:
  - `XLSX.read(buffer, { type: "array" })` +
    `XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false })` vira
    `readXlsxFile(file)`, que já devolve `Row[]` (array de arrays).
  - **Diferença de comportamento a tratar**: `read-excel-file` devolve
    células tipadas (`string | number | Date | boolean | null`), não tudo
    como string. Hoje o código assume string em todo lugar
    (`String(row[...] ?? "")`), o que já é seguro para os tipos não-data.
    Para células de data, hoje `normalizeImportDate` espera uma string
    (serial numérico ou `dd/mm/aaaa`) e usa `XLSX.SSF.parse_date_code`
    para converter serial. Com `read-excel-file`, uma célula de data já
    vem como objeto `Date` — `normalizeImportDate` precisa aceitar
    `Date` diretamente (mais simples que o parsing atual) e manter os
    outros formatos (string `dd/mm/aaaa`, string ISO) para quem digitar
    a data como texto.
  - CSV continua pelo `parseCsv` existente (`src/lib/csv.ts`), sem
    mudança — só o caminho `.xlsx` é afetado.

## Impact

- Toca só `src/lib/cadastrosImport.ts` e `package.json`/lockfile.
- Comportamento esperado idêntico do ponto de vista do usuário (mesmo
  fluxo de upload, mesmas colunas aceitas), mas a extração de data de
  células de planilha muda de "parsing manual de serial" para "delegar
  pro `read-excel-file`" — **isso precisa de teste manual com uma
  planilha `.xlsx` real** antes de considerar concluído, já que é lógica
  de dados que build/lint não pegam se estiver sutilmente errada.
- Fora de escopo: o fluxo de CSV (não muda), outras vulnerabilidades de
  dependências (tratadas em `upgrade-nextjs-patch`, já aplicada).
