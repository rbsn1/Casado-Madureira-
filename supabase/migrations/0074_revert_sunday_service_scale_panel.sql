-- Reverte o painel de Escala de Domingo (0071), removido do produto.
-- Não toca nas demais tabelas/grants de 0072 (grants gerais do CCM).

revoke select, insert, update, delete on table public.escalas_domingo_usuarios from anon, authenticated;
revoke select, insert, update, delete on table public.escalas_domingo from anon, authenticated;

revoke execute on function public.respond_sunday_service_scale(uuid, text) from authenticated;
revoke execute on function public.create_sunday_service_scale(text, date, time, uuid[]) from authenticated;
revoke execute on function public.can_assign_escala_domingo_usuario(uuid, uuid) from authenticated;
revoke execute on function public.can_manage_escala_domingo(uuid) from authenticated;
revoke execute on function public.normalize_escala_domingo_culto(text) from authenticated;

-- Dropar as tabelas também remove policies, triggers e índices associados.
drop table if exists public.escalas_domingo_usuarios;
drop table if exists public.escalas_domingo;

drop function if exists public.respond_sunday_service_scale(uuid, text);
drop function if exists public.create_sunday_service_scale(text, date, time, uuid[]);
drop function if exists public.sync_escala_domingo_usuario_context();
drop function if exists public.can_assign_escala_domingo_usuario(uuid, uuid);
drop function if exists public.can_manage_escala_domingo(uuid);
drop function if exists public.normalize_escala_domingo_culto(text);
