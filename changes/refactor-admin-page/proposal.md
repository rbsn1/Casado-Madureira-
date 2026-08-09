# Refatorar arquitetura de admin/page.tsx

## Why

`src/app/(app)/admin/page.tsx` tem 954 linhas — o maior arquivo do projeto
— e mistura 4 seções independentes num único componente: gestão de
usuários/roles, papel de parede do login, banner de evento especial, e
CRUD da agenda semanal. Cada seção tem seu próprio estado, efeitos e
handlers, sem nenhuma dependência real entre si (a única coisa
compartilhada é o helper `apiFetch`). Isso é o mesmo padrão já corrigido em
`cadastros/page.tsx` nesta sessão: um arquivo grande demais para revisar
com segurança, quando na verdade são 4 telas pequenas empilhadas.

Esta é uma reformulação **estrutural, sem mudança de comportamento**: os
mesmos formulários, tabelas e regras continuam, só reorganizados.

## What Changes

- Extrair `apiFetch` (helper de fetch autenticado via sessão Supabase) para
  `src/lib/adminApi.ts`.
- Extrair cada seção para um componente auto-contido (estado + efeitos +
  handlers + JSX da própria seção), no mesmo espírito do `CadastroForm.tsx`:
  - `src/components/admin/UsersSection.tsx` — criar usuário, listar
    usuários, atribuir role (`loadUsers`, `handleCreateUser`,
    `handleAddRole`, `roleOptions`).
  - `src/components/admin/LoginBackgroundSection.tsx` — upload do papel de
    parede do login (`loadBackground`, `handleUploadBackground`).
  - `src/components/admin/SpecialEventSection.tsx` — banner de evento
    especial (`loadSpecialEvent`, `handleSaveSpecialEvent`,
    `toIsoDateFromBr`).
  - `src/components/admin/WeeklyAgendaSection.tsx` — CRUD da agenda
    semanal (`loadAgendaEvents`, `handleCreateAgendaEvent`, `startEdit`,
    `handleUpdateAgendaEvent`, `handleDeleteAgendaEvent`, `weekdayOptions`).
- `admin/page.tsx` fica reduzido a composição: título da página + os 4
  componentes de seção em sequência.

## Impact

- Toca só `admin/page.tsx` e adiciona os 4 componentes novos + `adminApi.ts`.
  Nenhuma rota, API ou tabela é afetada.
- Correção em relação à auditoria original: o array `roleOptions` **já não
  lista mais** os papéis de discipulado (achado da auditoria estava
  desatualizado) — mantido exatamente como está, 8 papéis do CCM.
- **Fora de escopo, deixado como está**: o bug de `requireDiscipuladoAdmin()`
  nas rotas `/api/admin/users` e `/api/admin/roles` não é tocado (decisão já
  tomada anteriormente nesta sessão).
- Sem ambiente de teste com credenciais reais disponível aqui — a
  verificação fica em build/lint limpos; teste funcional dos 4 formulários
  (criar usuário, trocar papel de parede, salvar evento, CRUD de agenda)
  fica pendente de validação manual pelo usuário.
