# Cadastros

## Dados coletados

Um cadastro de pessoa no CCM tem só quatro campos, todos obrigatórios:

- **Nome completo** (mínimo de 3 caracteres);
- **Telefone** (celular brasileiro com DDD, normalizado por `src/lib/phone.ts`);
- **Culto de origem** (opções de `CULTO_ORIGEM_CCM_FORM_OPTIONS`, em `src/lib/cultoOrigem.ts`);
- **Data** (por padrão, a data local de hoje).

O sistema não coleta CPF, RG, data de nascimento, e-mail, endereço nem foto por
nenhum caminho: não há campo na interface, e as funções de banco que aceitavam
esses dados (`create_full_ccm_registration`, `generate_member_completion_token`,
`get_member_completion_payload`, `complete_member_registration_by_token`) não
têm permissão de execução para `anon` nem para `authenticated` (migration 0087).
Dados desses campos gravados antes dessa mudança continuam no banco, sem
exibição na interface.

## Onde se cadastra

- **`/cadastro`:** tela do perfil `CADASTRADOR`, pensada para uso durante o culto.
- **`/cadastros` → "Novo cadastro":** mesmo formulário
  (`src/components/cadastros/CadastroForm.tsx`) para os demais perfis.

As duas telas gravam pela RPC `create_quick_ccm_registration`, que aceita
`ADMIN_MASTER`, `PASTOR`, `SECRETARIA`, `NOVOS_CONVERTIDOS` e `CADASTRADOR`, e
evita duplicidade por telefone e congregação e por `request_id`.

## Listagem (`/cadastros`)

- Mostra nome, contato, data e culto, com busca por nome, telefone ou culto.
- `ADMIN_MASTER`, `PASTOR` e `SECRETARIA` podem editar os 4 campos e excluir.
- Exportação CSV com as colunas `nome, contato, data, culto`.
- Importação CSV/XLSX com as mesmas colunas (modelo em
  `public/cadastros_import_modelo.csv`). Colunas extras, como o antigo
  `status_cadastro`, são ignoradas.

Não existe status de complementação nem link de cadastro completo. A coluna
`cadastro_completo_status` continua no banco, mas a interface não a lê.
