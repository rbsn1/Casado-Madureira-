# Supabase CLI (Referencia Externa)

Este documento centraliza instrucoes externas da Supabase CLI para nao poluir o `README.md` principal do app.

## Instalacao
Use a documentacao oficial:

- https://supabase.com/docs/guides/local-development/cli/getting-started

## Comandos uteis (neste projeto)
```bash
npx supabase --version
npx supabase login
npx supabase link --project-ref uquhgeunncbjgiqljhgw
npx supabase db push
```

## Edge Functions
```bash
npx supabase functions deploy smooth-worker
npx supabase functions deploy enqueue-welcome
```

## Observacoes
- `db push` depende de login/link do projeto remoto.
- Em CI/CD, prefira `SUPABASE_ACCESS_TOKEN` por variavel de ambiente.
- Mantenha secrets sensiveis fora do repositorio.
