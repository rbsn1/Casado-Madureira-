# Tasks — Atualizar Next.js para 14.2.35

- [x] Atualizar `next` e `eslint-config-next` para `14.2.35` em `package.json`
- [x] Rodar `npm install` para atualizar o lockfile
- [x] Rodar `npm run build` e `npm run lint` sem erros novos
- [x] Rodar `npm audit` de novo e confirmar que a CVE crítica do Next some
      (confirmado: GHSA-f82v-jwr5-mffw não aparece mais; sobra uma cauda de
      CVEs médias/altas presentes em toda a linha 14.x/15.x, só resolvidas
      pela major 16 — fora de escopo desta proposta)
