-- ============================================================================
-- A record of every listing draft the suggestion feature produced.
--
-- Two jobs, and the second is the one that matters.
--
-- 1. The rate limit. Each call costs money and runs against somebody else's
--    API. A stuck retry loop, or one person discovering the button is fun,
--    should cost a refusal rather than a bill. Fifteen an hour per person is
--    far more than writing listings honestly requires.
--
-- 2. Reading what it actually suggested. This is a feature that writes words
--    in a lister's name, in a language many of them do not read comfortably.
--    "Is it any good, and has it ever said something we would not want said"
--    is not answerable from an empty table, and it is the question worth being
--    able to answer before this goes anywhere near more societies.
--
-- The prompt is stored as typed. It is what somebody wrote about their own
-- work — the sort of thing a person might paste a phone number into — so it is
-- readable only by an administrator and by the person who typed it.
--
-- Re-runnable.
-- ============================================================================

create table if not exists ai_drafts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete set null,
  provider_id uuid references providers(id) on delete set null,
  prompt      text not null,
  output      jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists ai_drafts_recent on ai_drafts (user_id, created_at desc);

alter table ai_drafts enable row level security;

drop policy if exists ai_drafts_admin on ai_drafts;
create policy ai_drafts_admin on ai_drafts for all
  using (is_admin()) with check (is_admin());

drop policy if exists ai_drafts_own on ai_drafts;
create policy ai_drafts_own on ai_drafts for select
  using (user_id = auth.uid());

-- A policy decides which ROWS, and a grant decides whether the table can be
-- read at all. Without this the policies above are unreachable and even an
-- administrator gets "permission denied" — the two are not the same thing and
-- forgetting the second is the classic way to write RLS that does nothing.
--
-- Read only. Rows are written by the definer functions below and by nothing
-- else, so nobody can forge an entry or clear their own to dodge the limit.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on ai_drafts to authenticated;
  end if;
end $$;


-- The reservation. Called BEFORE the model is asked, so a refusal costs
-- nothing: counting after the fact would mean paying for the request that
-- broke the limit.
create or replace function ai_draft_begin(p_prompt text, p_provider_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_recent int;
  v_id     uuid;
begin
  -- Signed in, always. Every route to this button is behind a login: a
  -- provider on their own listings screen, or an administrator on somebody
  -- else's. An anonymous caller has no business spending the API budget.
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in first.');
  end if;

  if coalesce(trim(p_prompt), '') = '' then
    return jsonb_build_object('ok', false, 'error',
      'Tell it a little about the work first.');
  end if;

  select count(*) into v_recent
    from ai_drafts
   where user_id = v_uid and created_at > now() - interval '1 hour';

  if v_recent >= 15 then
    return jsonb_build_object('ok', false, 'error',
      'That is a lot of suggestions in one hour. Have a go at writing this one yourself, and try again later.');
  end if;

  insert into ai_drafts (user_id, provider_id, prompt)
  values (v_uid, p_provider_id, left(trim(p_prompt), 2000))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function ai_draft_begin(text, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function ai_draft_begin(text, uuid) to authenticated;
  end if;
end $$;


-- What came back. Separate from the reservation so a failed or refused call
-- still leaves the attempt on the record — an empty output is itself the
-- useful signal that something is not working.
create or replace function ai_draft_finish(p_id uuid, p_output jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update ai_drafts
     set output = p_output
   where id = p_id and user_id = auth.uid();
end;
$$;

revoke all on function ai_draft_finish(uuid, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function ai_draft_finish(uuid, jsonb) to authenticated;
  end if;
end $$;
