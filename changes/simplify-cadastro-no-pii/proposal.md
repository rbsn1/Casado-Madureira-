# Simplificar o cadastro: sem PII sensível

## Why

Decisão do usuário (2026-10-05): o cadastro passa a ter só **nome completo,
telefone, culto de origem e data**, e o sistema deixa de coletar dados pessoais
sensíveis (CPF, RG, data de nascimento, e-mail, endereço, foto) por **qualquer
caminho**.

Hoje esses dados entram por dois caminhos:

1. **Formulário "completo"** dos perfis administrativos
   (`src/components/cadastros/CadastroForm.tsx`), com CPF e RG obrigatórios,
   gravados pela RPC `create_full_ccm_registration`.
2. **Link de complementação.** A equipe gera um token
   (`generate_member_completion_token`) e a pessoa preenche CPF, RG etc. em
   `/cadastro/completar` (página pública), que grava via
   `complete_member_registration_by_token`. Essa RPC é executável por `anon`.

O status `pendente / link_enviado / concluido` (`cadastro_completo_status`) só
existe para acompanhar esse segundo caminho.

Observação: nome e telefone continuam sendo dados pessoais pela LGPD. A
mudança reduz o que é coletado, não elimina dado pessoal.

## What Changes

**Um formulário só.** Todos os perfis usam o formulário de 4 campos (o mesmo
que hoje é do CADASTRADOR), gravado pela RPC `create_quick_ccm_registration`,
que já aceita `ADMIN_MASTER`, `PASTOR`, `SECRETARIA`, `NOVOS_CONVERTIDOS` e
`CADASTRADOR`. São os mesmos perfis que já podiam cadastrar pelo formulário
completo, mais o CADASTRADOR.

- `CadastroForm.tsx`: remover o ramo completo, os campos de PII e as props
  `isCadastradorOnly`/`canManageCadastrosDirectly`/`hasCompletionStatusColumn`.
- `src/lib/ccmQuickRegistration.ts`: remover `createFullCcmRegistration` e os
  tipos e mensagens associados.
- Excluir `src/lib/cpf.ts` (sem uso depois disso).

**Fim do link de complementação.**
- Excluir `src/app/(public)/cadastro/completar/page.tsx`.
- `src/lib/cadastrosApi.ts`: remover `generateCompletionLink`,
  `getCadastroCompletoLabel/Class`, `CadastroCompletoStatus` e a leitura de
  `cadastro_completo_status/at`.
- `src/hooks/useCadastrosPermissions.ts`: remover `canGenerateCompletionLink`.
- `src/app/(app)/cadastros/page.tsx`: remover o botão de gerar link, o selo e
  o filtro de status, a coluna de status no CSV exportado e os textos
  "formulário completo / pendente de complementação". O botão passa a se
  chamar "Novo cadastro".
- `src/app/(app)/relatorios/page.tsx` e `src/app/(app)/pessoas/[id]/page.tsx`:
  parar de ler e exibir o status de complementação.
- `src/lib/cadastrosImport.ts` e o modelo CSV/XLSX: a coluna `status_cadastro`
  sai do modelo. Se vier numa planilha antiga, é ignorada.
- Textos de `/cadastro` e do manual técnico que citam o link e a
  complementação.

**Banco:** migration `0087_disable_pii_collection.sql`, só com revogações, sem
apagar dados:
- `revoke execute` de `anon`/`authenticated`/`public` em
  `create_full_ccm_registration`, `generate_member_completion_token`,
  `get_member_completion_payload` e `complete_member_registration_by_token`;
- revogar (`revoked_at = now()`) os links de complementação ainda pendentes.

## Impact

- Admins deixam de ver o formulário completo. Cadastros novos de qualquer
  perfil têm só os 4 campos.
- Links de complementação já enviados param de funcionar: a página dá 404 e a
  RPC fica sem permissão.
- **Os dados já gravados (CPF, RG, nascimento, e-mail, endereço, foto) continuam
  no banco**, por decisão do usuário. Nenhuma coluna, tabela ou função é
  apagada, então reverter é só um `grant`. Limpar esses dados depois é outra
  proposta.
- A RPC rápida continua gravando `cadastro_completo_status = 'pendente'` no
  banco. Isso é inofensivo; a UI só deixa de mostrar.
- A migration é só criada. Aplicar no banco é um passo separado, com
  autorização.
- Fora de escopo: o formulário público `/novos-convertidos/cadastro` (pede nome,
  telefone e igreja de origem; não coleta PII sensível).
- Spec a atualizar no archive: `specs/cadastros/spec.md`.
