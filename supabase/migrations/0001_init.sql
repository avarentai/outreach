-- =========================================================================
-- Avarent Outbound — initial schema (matches live project `avarent-outbound`).
-- Mirrors src/lib/types.ts. Workspace-scoped, RLS-enforced.
--
-- ID design: the app owns entity IDs — prefixed nanoid strings (co_, ct_,
-- camp_, tpl_, …) and treats every ID as an opaque string (type ID = string).
-- So entity PKs and entity<->entity FKs are TEXT. Only workspace_id,
-- profiles.id (= auth.users.id) and user references stay UUID.
-- Run in the Supabase SQL editor or via `supabase db push`.
-- =========================================================================

create extension if not exists "pgcrypto";

-- ------------------------------- enums ------------------------------------
do $$ begin
  create type user_role as enum ('owner','admin','member','viewer');
  create type company_status as enum ('prospect','engaged','opportunity','customer','lost');
  create type pipeline_stage as enum ('new','contacted','replied','qualified','meeting_scheduled','demo_completed','proposal_sent','customer','closed_lost');
  create type email_validity as enum ('valid','risky','invalid','unknown');
  create type linkedin_status as enum ('none','not_connected','request_sent','connected','messaged','replied');
  create type template_category as enum ('initial','follow_up','breakup','referral','meeting_confirmation','custom');
  create type campaign_status as enum ('draft','active','paused','completed');
  create type sending_provider as enum ('resend','smtp');
  create type message_direction as enum ('outbound','inbound');
  create type message_status as enum ('draft','queued','scheduled','pending_approval','sent','delivered','bounced','failed','opened','replied','received');
  create type reply_sentiment as enum ('positive','neutral','negative','unclassified');
  create type thread_state as enum ('open','snoozed','archived');
  create type meeting_outcome as enum ('scheduled','completed','no_show','cancelled','won','lost');
  create type attachment_kind as enum ('pdf','deck','one_pager','contract','meeting_notes','other');
  create type activity_type as enum ('email_sent','email_scheduled','email_delivered','email_bounced','reply_received','positive_reply','campaign_created','campaign_paused','campaign_resumed','meeting_booked','meeting_completed','lead_imported','lead_created','template_edited','stage_changed','note_added','crawl_completed','user_login');
  create type follow_up_status as enum ('due','approved','skipped','sent');
exception when duplicate_object then null; end $$;

-- --------------------- workspaces / profiles / members --------------------
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null,
  timezone text not null default 'America/Toronto',
  created_at timestamptz not null default now()
);

-- profiles are 1:1 with auth.users
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  title text,
  avatar_color text,
  created_at timestamptz not null default now(),
  last_active_at timestamptz
);

create table if not exists memberships (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role user_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- RLS helper. The privileged lookup lives outside the exposed Data API schema;
-- the public wrapper is invoker-only and returns data scoped by auth.uid().
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.current_workspaces()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select workspace_id from public.memberships where user_id = (select auth.uid());
$$;
revoke execute on function private.current_workspaces() from public, anon;
grant execute on function private.current_workspaces() to authenticated;

create or replace function public.current_workspaces()
returns setof uuid language sql stable security invoker set search_path = '' as $$
  select * from private.current_workspaces();
$$;
revoke execute on function public.current_workspaces() from public, anon;
grant execute on function public.current_workspaces() to authenticated;

-- ------------------------------- companies --------------------------------
create table if not exists companies (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  domain text not null,
  website text,
  industry text,
  status company_status not null default 'prospect',
  notes text,
  tags text[] not null default '{}',
  owner_id uuid references profiles(id),
  enrichment jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, domain)
);
create index if not exists companies_ws_idx on companies(workspace_id);
create index if not exists companies_status_idx on companies(workspace_id, status);

-- ------------------------------- templates --------------------------------
create table if not exists templates (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  category template_category not null default 'custom',
  subject text not null default '',
  body text not null default '',
  owner_id uuid references profiles(id),
  tags text[] not null default '{}',
  archived boolean not null default false,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists templates_ws_idx on templates(workspace_id);

create table if not exists snippets (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  trigger text not null,
  label text not null,
  content text not null
);

-- ------------------------------- sequences --------------------------------
create table if not exists sequences (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --------------------------- sending accounts -----------------------------
create table if not exists sending_accounts (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  label text not null,
  from_name text not null,
  from_email text not null,
  provider sending_provider not null default 'resend',
  daily_limit int not null default 50,
  warmup_enabled boolean not null default true,
  spf text not null default 'unknown',
  dkim text not null default 'unknown',
  dmarc text not null default 'unknown',
  reputation_score int not null default 75,
  active boolean not null default true,
  -- credentials stored per-account (encrypted at rest); never surfaced to client
  smtp_host text, smtp_port int, smtp_user text, smtp_pass text,
  created_at timestamptz not null default now()
);

-- ------------------------------- campaigns --------------------------------
create table if not exists campaigns (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  owner_id uuid references profiles(id),
  status campaign_status not null default 'draft',
  sequence_id text references sequences(id),
  sending_account_ids text[] not null default '{}',
  sending_window jsonb not null default '{}'::jsonb,
  stop_on_reply boolean not null default true,
  require_approval boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz
);
create index if not exists campaigns_ws_idx on campaigns(workspace_id);

-- ------------------------------- contacts ---------------------------------
create table if not exists contacts (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  email_validity email_validity not null default 'unknown',
  job_title text,
  linkedin_url text,
  phone text,
  stage pipeline_stage not null default 'new',
  stage_entered_at timestamptz not null default now(),
  owner_id uuid references profiles(id),
  campaign_id text references campaigns(id) on delete set null,
  tags text[] not null default '{}',
  score int not null default 0,
  score_breakdown jsonb,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  linkedin_status linkedin_status not null default 'none',
  linkedin_notes text,
  unsubscribed boolean not null default false,
  bounced boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, email)
);
create index if not exists contacts_ws_idx on contacts(workspace_id);
create index if not exists contacts_company_idx on contacts(company_id);
create index if not exists contacts_stage_idx on contacts(workspace_id, stage);
create index if not exists contacts_followup_idx on contacts(workspace_id, next_follow_up_at);

-- -------------------------------- threads ---------------------------------
create table if not exists threads (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  contact_id text not null references contacts(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  campaign_id text references campaigns(id) on delete set null,
  subject text not null,
  owner_id uuid references profiles(id),
  state thread_state not null default 'open',
  sentiment reply_sentiment not null default 'unclassified',
  interested boolean,
  meeting_booked boolean not null default false,
  snoozed_until timestamptz,
  last_message_at timestamptz not null default now(),
  unread boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists threads_ws_idx on threads(workspace_id);
create index if not exists threads_contact_idx on threads(contact_id);

-- ---------------------------- email messages ------------------------------
create table if not exists email_messages (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  thread_id text not null references threads(id) on delete cascade,
  contact_id text not null references contacts(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  campaign_id text references campaigns(id) on delete set null,
  sequence_step_id text,
  template_id text references templates(id) on delete set null,
  sending_account_id text references sending_accounts(id),
  direction message_direction not null,
  status message_status not null default 'queued',
  subject text not null,
  body text not null,
  from_email text not null,
  to_email text not null,
  provider_message_id text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  replied_at timestamptz,
  bounce_reason text,
  word_count int not null default 0,
  ab_variant text,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists messages_ws_idx on email_messages(workspace_id);
create index if not exists messages_thread_idx on email_messages(thread_id);
create index if not exists messages_campaign_idx on email_messages(campaign_id);
create index if not exists messages_status_idx on email_messages(workspace_id, status);
create unique index if not exists email_messages_provider_message_id_unique
  on email_messages(provider_message_id) where provider_message_id is not null;

-- send queue (the worker drains this)
create table if not exists email_queue (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  message_id text not null references email_messages(id) on delete cascade,
  send_after timestamptz not null default now(),
  locked_at timestamptz,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists queue_ready_idx on email_queue(send_after) where locked_at is null;

-- ------------------------ comments / notes / files ------------------------
create table if not exists thread_comments (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  author_id uuid references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists notes (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  author_id uuid references profiles(id),
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attachments (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  name text not null,
  kind attachment_kind not null default 'other',
  size_bytes bigint not null default 0,
  storage_path text not null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workspace-attachments',
  'workspace-attachments',
  false,
  26214400,
  array[
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -------------------------------- meetings --------------------------------
create table if not exists meetings (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  contact_id text not null references contacts(id) on delete cascade,
  title text not null,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 30,
  attendees text[] not null default '{}',
  agenda text,
  notes text,
  outcome meeting_outcome not null default 'scheduled',
  next_action text,
  owner_id uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists meetings_ws_idx on meetings(workspace_id);

-- ------------------------------- activities -------------------------------
create table if not exists activities (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  type activity_type not null,
  actor_id uuid references profiles(id),
  company_id text references companies(id) on delete cascade,
  contact_id text references contacts(id) on delete cascade,
  campaign_id text references campaigns(id) on delete cascade,
  summary text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activities_ws_idx on activities(workspace_id, created_at desc);

-- ------------------------------ experiments -------------------------------
create table if not exists experiments (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  dimension text not null,
  status text not null default 'running',
  campaign_id text references campaigns(id) on delete set null,
  variants jsonb not null default '[]'::jsonb,
  winner_key text,
  confidence numeric,
  min_sample_per_variant int not null default 40,
  created_at timestamptz not null default now()
);

-- ------------------------------ saved views -------------------------------
create table if not exists saved_views (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  entity text not null,
  filters jsonb not null default '[]'::jsonb,
  sort jsonb,
  system boolean not null default false,
  icon text
);

-- --------------------------- scoring + follow-ups -------------------------
create table if not exists scoring_config (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  rules jsonb not null default '[]'::jsonb,
  max_score int not null default 100,
  updated_at timestamptz not null default now()
);

create table if not exists follow_ups (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  contact_id text not null references contacts(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  campaign_id text references campaigns(id) on delete set null,
  template_id text references templates(id) on delete set null,
  due_at timestamptz not null,
  status follow_up_status not null default 'due',
  draft_subject text not null default '',
  draft_body text not null default '',
  reason text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists followups_ws_idx on follow_ups(workspace_id, status);

-- ---------------------------- crawl results -------------------------------
create table if not exists crawl_results (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id text references companies(id) on delete cascade,
  domain text not null,
  status text not null default 'queued',
  pages_crawled int not null default 0,
  pages jsonb not null default '[]'::jsonb,
  emails_found text[] not null default '{}',
  social_links jsonb not null default '[]'::jsonb,
  tech_stack jsonb not null default '[]'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- ---------------------------- updated_at trigger --------------------------
create or replace function set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['companies','contacts','templates','sequences','campaigns','notes','scoring_config'] loop
    execute format('drop trigger if exists trg_%1$s_updated on %1$s;', t);
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- --------------------------------- RLS ------------------------------------
-- Every entity table is workspace-scoped: a user may access rows whose
-- workspace_id is in their membership set. Service-role (worker) bypasses RLS.
do $$
declare t text;
begin
  foreach t in array array[
    'companies','contacts','templates','snippets','sequences','sending_accounts',
    'campaigns','threads','email_messages','email_queue','thread_comments','notes',
    'attachments','meetings','activities','experiments','saved_views','scoring_config',
    'follow_ups','crawl_results'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists ws_all on %I;', t);
    execute format(
      'create policy ws_all on %I for all using (workspace_id in (select current_workspaces())) with check (workspace_id in (select current_workspaces()));',
      t
    );
  end loop;
end $$;

alter table workspaces enable row level security;
drop policy if exists ws_self on workspaces;
create policy ws_self on workspaces for select using (id in (select current_workspaces()));

alter table profiles enable row level security;
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for all using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_ws on profiles;
create policy profiles_ws on profiles for select using (
  id in (select user_id from memberships where workspace_id in (select current_workspaces()))
);

alter table memberships enable row level security;
drop policy if exists memberships_self on memberships;
create policy memberships_self on memberships for select using (user_id = auth.uid() or workspace_id in (select current_workspaces()));
