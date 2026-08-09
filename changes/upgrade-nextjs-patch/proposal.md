# Atualizar Next.js dentro da série 14.2.x

## Why

`npm audit` aponta `next@14.2.15` com uma CVE crítica (bypass de
autorização em middleware, GHSA-f82v-jwr5-mffw) e várias outras altas,
todas corrigidas em versões posteriores da própria série 14.2.x — não
precisa da major 16 sugerida por padrão pelo `npm audit fix --force`.
Confirmado que este projeto **não usa `middleware.ts`**, então a CVE mais
grave nem se aplica hoje, mas as outras (DoS em Server Actions, SSRF, cache
poisoning) seguem valendo. `14.2.35` é o último patch da série 14.2 no
momento desta proposta.

## What Changes

- `next`: `14.2.15` → `14.2.35`.
- `eslint-config-next`: `14.2.15` → `14.2.35` (mantido em lockstep, como o
  próprio Next.js recomenda).
- Nenhuma mudança de código esperada — são patches dentro da mesma minor,
  sem mudança de API pública documentada entre 14.2.15 e 14.2.35.

## Impact

- Build e lint precisam passar limpos após o bump (verificação obrigatória
  antes de considerar concluído).
- Fora de escopo: migração para Next 15/16 (major, mudanças de API reais,
  merece proposta própria se decidirem seguir esse caminho depois).
- Fora de escopo: as demais vulnerabilidades de dependências indiretas
  (`tar`, `ws`, etc.) e o `xlsx` (tratado em proposta separada).
