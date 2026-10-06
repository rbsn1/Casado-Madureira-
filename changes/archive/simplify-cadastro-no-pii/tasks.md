# Tasks: Simplificar cadastro sem PII

- [x] `CadastroForm.tsx`: formulário único de 4 campos
- [x] `ccmQuickRegistration.ts`: remover cadastro completo
- [x] Excluir `src/lib/cpf.ts`
- [x] Excluir `src/app/(public)/cadastro/completar/page.tsx`
- [x] `cadastrosApi.ts`: remover link e status de complementação
- [x] `useCadastrosPermissions.ts`: remover `canGenerateCompletionLink`
- [x] `cadastros/page.tsx`: remover botão de link, selo, filtro, coluna CSV e textos
- [x] `relatorios/page.tsx` e `pessoas/[id]/page.tsx`: remover status
- [x] `cadastrosImport.ts` e modelos CSV/XLSX: tirar `status_cadastro`
- [x] Textos de `/cadastro` e do manual técnico
- [x] Criar `supabase/migrations/0087_disable_pii_collection.sql` (sem aplicar)
- [x] Build e lint no Node 20 sem erros
- [x] (Separado, com autorização) aplicar a migration
