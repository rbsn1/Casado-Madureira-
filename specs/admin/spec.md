# Administração

A tela `/admin` (perfil `ADMIN_MASTER`) tem duas seções:

- **Usuários e permissões** (`UsersSection`): criar e editar usuários e
  atribuir papéis.
- **Fundo da tela de login** (`LoginBackgroundSection`): URL da imagem, guardada
  em `app_settings` com a chave `login_background_url`.

O sistema não tem agenda semanal nem painel de evento especial. A tabela
`weekly_schedule_events` e a configuração `special_event` foram removidas
(migration 0088), e as rotas `/agenda` e `/admin/agenda-semanal` não existem.
