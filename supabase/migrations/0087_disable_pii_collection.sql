-- Para de coletar PII sensível (CPF, RG, nascimento, e-mail, endereço, foto).
-- Proposta: changes/simplify-cadastro-no-pii/proposal.md
--
-- Só revoga acesso: nenhuma coluna, tabela, função ou dado é apagado.
-- Para reverter, basta reaplicar os grants originais (0020, 0069, 0072).

revoke execute on function public.create_full_ccm_registration(text, text, date, text, text, text, text, text, text, date, text, text, text, uuid)
  from public, anon, authenticated;

revoke execute on function public.generate_member_completion_token(uuid, int)
  from public, anon, authenticated;

revoke execute on function public.get_member_completion_payload(text)
  from public, anon, authenticated;

revoke execute on function public.complete_member_registration_by_token(text, text, text, text, date, text, text, text)
  from public, anon, authenticated;

-- Links de complementação ainda pendentes deixam de valer.
update public.member_profile_completion_links
set revoked_at = now()
where used_at is null
  and revoked_at is null;
