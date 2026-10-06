# Plataforma

- **Node.js 20 ou superior** (`.nvmrc` e `engines.node` no `package.json`).
  Versões antigas não rodam `next build` nem `next lint`.
- **Next.js 14.2.x.** As vulnerabilidades que restam no `next` só são corrigidas
  na 15.5.24+, uma troca de versão principal ainda não feita. O projeto não usa
  `next/image` nem `middleware.ts`.
- **Dependências:** atualizações sem troca de versão principal via `npm audit fix`.
  Trocas de versão principal (`next`, `tailwindcss`, `eslint-config-next`) exigem
  proposta própria.
- **Componentes de UI:** só existem os que são usados (`src/components/ui/`:
  `button`, `checkbox`, `input`, `modal`).
- **Migrations:** cada arquivo em `supabase/migrations/` precisa ter um número de
  versão único. O histórico remoto está alinhado com o repositório até a 0088.
