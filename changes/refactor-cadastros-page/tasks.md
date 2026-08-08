# Tasks — Refatorar arquitetura da página de Cadastros

- [x] Mapear todos os estados/handlers de `cadastros/page.tsx` e destino de cada um
      (hook de permissão / api de dados / import / form / página)
- [x] Criar `src/hooks/useCadastrosPermissions.ts` com a lógica de `loadPermissions`
      e os estados derivados (`canGenerateCompletionLink`, `canManageCadastrosDirectly`,
      `isCadastradorOnly`). `hasCompletionStatusColumn`/`hasCultoColumn` ficaram em
      `cadastrosApi.ts` por serem detecção de schema descoberta no carregamento da
      lista, não permissão de papel — pequeno ajuste de organização em relação à
      proposta original, sem mudar comportamento.
- [x] Criar `src/lib/cadastrosImport.ts` com o fluxo de import (parse XLSX/CSV,
      normalização de datas, envio) e os helpers de normalização
- [x] Criar `src/lib/cadastrosApi.ts` com carregar/excluir/gerar link e os tipos/labels
      de status, reaproveitando `createFullCcmRegistration`/`createQuickCcmRegistration`
- [x] Criar `src/components/cadastros/CadastroForm.tsx` com o formulário de
      criação/edição (campos e validação atuais, sem mudança de UI)
- [x] Reescrever `cadastros/page.tsx` para compor os hooks/componentes extraídos,
      removendo a lógica duplicada
- [x] Rodar `npm run build` e `npm run lint` sem erros novos (Node 20 via nvm;
      o Node do sistema é v12, incompatível com Next 14)
- [x] Verificação parcial: build limpo, lint limpo, `/cadastros` responde 200 e
      renderiza sem erro de aplicação. **Não foi possível testar end-to-end**
      (criar/editar/excluir, import CSV/XLSX, gating de permissão) porque não há
      `.env.local` com credenciais Supabase neste ambiente — fica pendente de
      validação manual pelo usuário com um projeto Supabase real.
