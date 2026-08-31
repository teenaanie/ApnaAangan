-- ============================================================================
-- A line saying why, when a request is declined.
--
-- Declining is free and always will be, and a provider who is full should say
-- no rather than leave a neighbour waiting. But "declined" on its own tells
-- the resident nothing: they cannot tell whether it was the date, the job, or
-- them. One is worth asking again next week; another means look elsewhere.
--
-- Optional on purpose. Declining has to stay a single tap or providers will
-- stop answering at all, which is the outcome this whole flow exists to avoid.
-- The box sits beside the button and is usually left empty.
--
-- Nothing sends this to the resident automatically — during the pilot an
-- administrator relays it by hand from the admin screen, where it appears in
-- the pre-written WhatsApp message. That is a deliberate choice: a real person
-- making contact is worth more at twenty listers than an automatic email, and
-- the resident's email address is not something we hold.
--
-- Re-runnable.
-- ============================================================================

alter table leads
  add column if not exists decline_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_decline_reason_len') then
    alter table leads add constraint leads_decline_reason_len
      check (decline_reason is null or char_length(decline_reason) <= 300);
  end if;
end $$;

comment on column leads.decline_reason is
  'Optional one line from the provider when declining. Relayed to the resident by an administrator; never shown publicly.';
