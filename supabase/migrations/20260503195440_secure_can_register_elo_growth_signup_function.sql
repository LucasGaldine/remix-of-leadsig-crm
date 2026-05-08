begin;

alter function public.can_register_elo_growth_signup(text, text)
  security definer
  set search_path = public, pg_temp;

revoke all on function public.can_register_elo_growth_signup(text, text) from public;
revoke all on function public.can_register_elo_growth_signup(text, text) from anon;
revoke all on function public.can_register_elo_growth_signup(text, text) from authenticated;
grant execute on function public.can_register_elo_growth_signup(text, text) to service_role;

commit;;
