-- Bunk Buddy: schema. Run migrations in order (0001 -> 0004).
create extension if not exists pgcrypto;

create type verification_status as enum ('unverified','pending','verified','rejected');
create type availability_status as enum ('available','busy','maybe','in_class');
create type request_status      as enum ('open','matched','expired','cancelled');
create type match_status        as enum ('active','ended');
create type user_role           as enum ('student','admin');
create type report_status       as enum ('open','reviewing','resolved','dismissed');

-- Multi-college: every student/department/location hangs off a college.
create table colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  domain text unique,  -- e.g. 'college.edu': signing in with this email domain = auto verified
  verification_method text not null default 'id_admin' check (verification_method in ('email','id_admin','api')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now()
);

create table departments (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references colleges on delete cascade,
  name text not null,
  unique (college_id, name)
);

create table campus_locations (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references colleges on delete cascade,
  name text not null,
  unique (college_id, name)
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  photo_url text,
  college_id uuid references colleges,
  course text,
  department text,
  year smallint check (year between 1 and 8),
  student_id text,
  verification_status verification_status not null default 'unverified',
  availability_status availability_status not null default 'busy',
  availability_until timestamptz,
  bio text check (char_length(bio) <= 280),
  interests text[] not null default '{}',
  role user_role not null default 'student',
  suspended boolean not null default false,
  flagged boolean not null default false,
  created_at timestamptz not null default now(),
  last_active timestamptz not null default now()
);
create index profiles_matching_idx on profiles (college_id, availability_status, last_active desc);

create table verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  front_path text,   -- nulled after review (we do not keep ID images)
  back_path text,
  ocr_data jsonb,    -- hints only, never the source of truth
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  note text,
  reviewed_by uuid references profiles,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on verification_requests (status, created_at);

create table bunk_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  college_id uuid not null references colleges,
  activity text not null check (activity in ('bunk_partner','chai_coffee','food','games','sports','walk','just_hangout','meet_new_people')),
  duration_minutes int not null check (duration_minutes between 15 and 480),
  visibility text not null default 'college' check (visibility in ('college')),
  status request_status not null default 'open',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create unique index one_open_request_per_user on bunk_requests (user_id) where status = 'open';
create index on bunk_requests (status, expires_at);

-- Who got notified about which request. Hides the requester's identity from recipients.
create table request_inbox (
  request_id uuid not null references bunk_requests on delete cascade,
  recipient_id uuid not null references profiles on delete cascade,
  activity text not null,
  duration_minutes int not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (request_id, recipient_id)
);
create index on request_inbox (recipient_id, expires_at);

create table matches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references bunk_requests,
  user1_id uuid not null references profiles,  -- requester
  user2_id uuid not null references profiles,  -- accepter
  status match_status not null default 'active',
  meeting_spot text,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references profiles
);
create index on matches (user1_id, status);
create index on matches (user2_id, status);

create table messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches on delete cascade,
  sender_id uuid not null references profiles,
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index on messages (match_id, created_at);

create table blocks (
  blocker_id uuid not null references profiles on delete cascade,
  blocked_id uuid not null references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index on blocks (blocked_id);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles on delete cascade,
  reported_user_id uuid not null references profiles on delete cascade,
  match_id uuid references matches,
  reason text not null check (reason in ('harassment','fake_identity','inappropriate','spam','threats','other')),
  description text check (char_length(description) <= 1000),
  status report_status not null default 'open',
  created_at timestamptz not null default now()
);
create index on reports (reported_user_id, created_at);
create index on reports (status, created_at);

create table feedback (
  match_id uuid not null references matches on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

-- New auth user -> empty profile row
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1), ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
