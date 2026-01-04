insert into public.usuarios_perfis (user_id, role, active)
values
  ('00000000-0000-0000-0000-000000000001', 'ADMIN_MASTER', true)
on conflict do nothing;

insert into public.pessoas (id, nome_completo, telefone_whatsapp, origem, data, observacoes, created_by)
values
  ('00000000-0000-0000-0000-000000000101', 'Ana Souza', '(21) 99999-0000', 'Culto Domingo', current_date, 'Primeiro contato', '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

insert into public.integracao_novos_convertidos (pessoa_id, status, responsavel_id)
values ('00000000-0000-0000-0000-000000000101', 'EM_ANDAMENTO', '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

insert into public.departamentos (id, nome, descricao, responsavel_id, ativo)
values
  ('00000000-0000-0000-0000-000000000201', 'Louvor', 'Ministério de louvor', '00000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0000-000000000202', 'Kids', 'Ministério infantil', '00000000-0000-0000-0000-000000000001', true)
on conflict do nothing;

insert into public.pessoa_departamento (pessoa_id, departamento_id, funcao, status)
values ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', 'Voz', 'ATIVO')
on conflict do nothing;
