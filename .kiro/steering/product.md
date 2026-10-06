# Product

**Casados com a Madureira (CCM)** is an internal SaaS platform for the Casados com a Madureira church community. It supports member registration, discipleship tracking, volunteer management, and administrative operations.

## Core Modules

- **Dashboard** — KPI overview of registrations, baptisms, and member flow
- **Cadastros** — Member registration and management (new converts, CCM members)
- **Relatórios** — Reports and analytics
- **Admin** — User management, system settings, login background, weekly agenda
- **WhatsApp** — Welcome message queue via WhatsApp Cloud API

## Access Control

The app uses role-based access control (RBAC). Roles are stored in `public.usuarios_perfis` and resolved server-side via Supabase RPC (`get_my_context`, `get_my_roles`).

**CCM roles:** `ADMIN_MASTER`, `SUPER_ADMIN`, `PASTOR`, `SECRETARIA`, `NOVOS_CONVERTIDOS`, `LIDER_DEPTO`, `VOLUNTARIO`, `CADASTRADOR`

- `ADMIN_MASTER` / `SUPER_ADMIN` are global admins with full access
- `CADASTRADOR` is a restricted role that only sees the `/cadastro` route

## Language

The codebase, UI labels, error messages, and documentation are written in **Brazilian Portuguese**.
