# Casados com a Madureira (SaaS)

Aplicação Next.js (App Router) + Tailwind + Supabase para gestão de integração, batismo e voluntariado.

## Requisitos atendidos
- UI com menu verde chá, área de conteúdo branca e dashboard limpo com 7 blocos.
- Fluxo público `/cadastro` (mobile-first) criando pessoas, fila de integração e timeline.
- Telas internas: Dashboard, Cadastros, Perfil, Novos Convertidos, Departamentos, Relatórios (consolidado anual apenas ao gerar), Admin.
- RBAC (ADMIN_MASTER, PASTOR, SECRETARIA, NOVOS_CONVERTIDOS, LIDER_DEPTO, VOLUNTARIO) com políticas RLS no Supabase.
- Migrations SQL com tabelas, gatilhos de timeline e políticas.

## Configuração rápida
```bash
# instalar dependências (necessita acesso ao registry npm)
npm install

# variáveis de ambiente
cp .env.example .env.local

# desenvolvimento
npm run dev
```

## Variáveis de ambiente
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Banco de dados (Supabase)
1. Instale o CLI do Supabase (`brew install supabase/tap/supabase` ou similar).
2. Aplique migrations:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   supabase db remote commit 0001_init --file supabase/migrations/0001_init.sql
   ```
3. Opcional: rode seed localmente
   ```bash
   supabase db reset --local --use-migrations --seed supabase/seed/seed.sql
   ```

### Esquema principal
- `pessoas` (cadastro público/internal)
- `integracao_novos_convertidos` (fila/status/responsável)
- `batismos`
- `departamentos`
- `pessoa_departamento`
- `eventos_timeline`
- `usuarios_perfis` (mapa de roles por usuário)

### Regras automáticas
- Gatilhos registram eventos na `eventos_timeline` para cadastros, encaminhamento, contatos, integração, batismo e vínculo em departamento.
- Inserções públicas criam automaticamente fila em `integracao_novos_convertidos` com status `PENDENTE`.

### RLS e RBAC
- Políticas permitem leitura/escrita apenas a usuários autenticados com perfil adequado.
- Inserção anônima em `/cadastro` permitida apenas para criar pessoas/fila.
- Views auxiliares: `auth_users_with_role` para verificar papel ativo.

## Importação (CSV/XLSX)
A tela de cadastros possui botão de importação. Para lógica real:
1. Parsear CSV/XLSX (ex.: `papaparse` ou `xlsx`).
2. Exibir prévia + mapeamento de colunas.
3. Validar duplicidade por telefone (fallback: nome+data).
4. Gerar relatório de erros para download.

## Deploy
- Deploy no Vercel usando `npm run build`.
- Configurar envs no Vercel e a URL do Supabase.
- Habilitar storage/edge functions conforme necessidade (não obrigatório para MVP).

## Testes
Nenhum teste automatizado incluso ainda. Adicione e2e (Playwright) e unitários conforme necessário.
