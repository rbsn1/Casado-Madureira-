# Tasks — Unificar lógica de login

- [x] Criar `src/components/auth/LoginForm.tsx` com campos, submit, reset de
      senha, `getAuthScope()`, suporte a `?next=`, prop `showRememberMe`
- [x] Atualizar `src/app/(public)/acesso-interno/page.tsx` para usar
      `<LoginForm showRememberMe />`
- [x] Atualizar `src/app/(public)/login/page.tsx` para usar `<LoginForm />`
- [~] Conferir visualmente (screenshot): bloqueado por colisão de cache `.next`
      com um dev server de outra sessão rodando em paralelo no mesmo projeto
      (MODULE_NOT_FOUND intermitente, não relacionado ao código). Revisão
      manual do JSX de ambas as páginas confirma estrutura idêntica à anterior
      (mesmo header/card/copy/links, só o form interno trocado). Recomendo
      conferir visualmente você mesmo ao rodar localmente sem outro `next dev`
      concorrente.
- [x] Rodar `npm run build` e `npm run lint` sem erros novos
