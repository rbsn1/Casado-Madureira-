# Refatorar arquitetura da página de Cadastros

## Why

`src/app/(app)/cadastros/page.tsx` tem 1294 linhas, das quais ~1130 (linhas 165–1287)
formam um único componente de cliente (`CadastrosContent`) que mistura:

- Carregamento de permissões (`canGenerateCompletionLink`, `canManageCadastrosDirectly`,
  `isCadastradorOnly`, detecção de colunas via `hasCompletionStatusColumn`/`hasCultoColumn`)
- ~13 campos de formulário em `useState` individuais (nome, telefone, dataCadastro,
  cultoOrigem, igrejaOrigem, bairro, cpf, rg, fotoUrl, dataNascimento, email, endereco,
  observacoes)
- CRUD completo (`handleSubmit`, `handleDelete`, `handleGenerateCompletionLink`)
- Import/export de CSV e XLSX (`handleImportFile`, ~170 linhas, com normalização de datas
  e detecção de colunas ausentes)
- Busca/filtro e renderização de tabela

Esse acoplamento torna qualquer mudança arriscada de revisar e testar — o projeto não
tem testes automatizados, e o histórico recente já mostra vários commits de `fix`
reativos em produção nesse mesmo módulo. Separar responsabilidades em unidades menores
reduz o raio de impacto de cada mudança futura e facilita entender o que é lógica de
permissão, o que é acesso a dados e o que é UI.

Esta reformulação é **estrutural, sem mudança de comportamento**: a UX, as regras de
negócio e os textos permanecem idênticos.

## What Changes

- Extrair a lógica de permissões (`canGenerateCompletionLink`, `canManageCadastrosDirectly`,
  `isCadastradorOnly`, `hasCompletionStatusColumn`, `hasCultoColumn` e o `loadPermissions`
  associado) para um hook `src/hooks/useCadastrosPermissions.ts`.
- Extrair as operações de CRUD (criar rápido/completo, editar, excluir, gerar link de
  completamento) para um módulo de acesso a dados (`src/lib/cadastrosApi.ts`, reaproveitando
  `createFullCcmRegistration`/`createQuickCcmRegistration` já existentes em
  `ccmQuickRegistration.ts`).
- Extrair o import de CSV/XLSX (`handleImportFile` e helpers de normalização de data/coluna)
  para `src/lib/cadastrosImport.ts`.
- Extrair o formulário de criação/edição para um componente dedicado
  `src/components/cadastros/CadastroForm.tsx`.
- Reduzir `cadastros/page.tsx` a uma composição fina: carrega a lista, conecta os hooks e
  componentes extraídos, renderiza tabela/busca/filtro.

## Impact

- Toca apenas `src/app/(app)/cadastros/page.tsx` e adiciona novos arquivos em
  `src/hooks`, `src/lib` e `src/components/cadastros`. Sem mudanças de rota, schema ou
  migrations.
- Fora de escopo (explicitamente adiado): `discipulado/convertidos`, `discipulado/admin`,
  os três componentes de login, e qualquer redesenho visual/UX.
- Risco: sem testes automatizados, a verificação é manual — ver checklist em `tasks.md`.
- Este projeto ainda não tem `specs/cadastros/spec.md`; ao arquivar esta mudança, criamos
  esse arquivo documentando o comportamento final do módulo.
