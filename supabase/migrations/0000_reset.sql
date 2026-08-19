-- ============================================================================
-- RESET — drops everything the Aangan migrations create, in dependency order.
--
-- Run this ONLY when you want to start the database over: after a migration
-- failed halfway, or when you want to re-seed from scratch. It is safe to run
-- on a partially-built database and safe to run twice.
--
-- IT DELETES ALL AANGAN DATA. Do not run it once you have real providers.
--
-- It touches only Aangan's own objects — it does not drop the public schema,
-- so Supabase's auth, storage and realtime setup is left alone.
-- ============================================================================

-- Views first (they depend on the tables).
drop view if exists lead_inbox    cascade;
drop view if exists listing_cards cascade;

-- Tables, children before parents.
drop table if exists reports            cascade;
drop table if exists reviews            cascade;
drop table if exists provider_updates   cascade;
drop table if exists leads              cascade;
drop table if exists listing_localities cascade;
drop table if exists listings           cascade;
drop table if exists provider_contacts  cascade;
drop table if exists providers          cascade;
drop table if exists categories         cascade;
drop table if exists profiles           cascade;
drop table if exists localities         cascade;

-- Sequences used for the human-readable IDs.
drop sequence if exists provider_public_seq cascade;
drop sequence if exists lead_ref_seq        cascade;

-- Functions and triggers.
drop function if exists on_lead_accepted()        cascade;
drop function if exists on_lead_created()         cascade;
drop function if exists quote_lead_fee()          cascade;
drop function if exists lead_fee_for_listing(uuid) cascade;
drop function if exists touch_updated_at()        cascade;
drop function if exists handle_new_user()         cascade;
drop function if exists my_provider_id()          cascade;
drop function if exists is_admin()                cascade;
drop function if exists test_as(uuid)             cascade;

-- Enums last — nothing references them once the tables are gone.
drop type if exists moderation      cascade;
drop type if exists update_kind     cascade;
drop type if exists lead_status     cascade;
drop type if exists provider_status cascade;
drop type if exists user_role       cascade;

-- Now run 0001 through 0005 in order.
