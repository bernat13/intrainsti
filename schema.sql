-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. RESET SCHEMA (DROP EVERYTHING)
-- ==========================================

-- Drop Trigger FIRST (because it depends on the function)
drop trigger if exists on_auth_user_created on auth.users;

-- Drop Tables (Cascade drops policies and foreign keys)
drop table if exists calendar_events cascade;

drop table if exists calendar_days cascade;

drop table if exists announcements cascade;

drop table if exists tickets cascade;

drop table if exists departments cascade;

drop table if exists institute_members cascade;

drop table if exists user_profiles cascade;

drop table if exists institutes cascade;

-- Functions
drop function if exists get_my_institutes ();

drop function if exists is_member_of (uuid);

drop function if exists is_institute_admin (uuid);

drop function if exists handle_new_user ();

-- ==========================================
-- 2. TABLES
-- ==========================================

-- Institutes Table
create table if not exists institutes (
    id uuid primary key default uuid_generate_v4 (),
    name text not null,
    domain text,
    status text default 'pending',
    admin_email text,
    created_at timestamp
    with
        time zone default now()
);

-- User Profiles
create table if not exists user_profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text not null,
    display_name text,
    photo_url text,
    is_superadmin boolean default false,
    last_login timestamp
    with
        time zone
);

-- Institute Members
create table if not exists institute_members (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references user_profiles(id) on delete cascade,
  institute_id uuid references institutes(id) on delete cascade,
  roles text[] default '{}',
  department text,
  status text default 'active',
  created_at timestamp with time zone default now(),
  unique(user_id, institute_id)
);

-- Departments
create table if not exists departments (
    id uuid primary key default uuid_generate_v4 (),
    institute_id uuid references institutes (id) on delete cascade,
    name text not null,
    code text,
    active boolean default true,
    created_at timestamp
    with
        time zone default now()
);

-- Tickets
create table if not exists tickets (
    id uuid primary key default uuid_generate_v4 (),
    institute_id uuid references institutes (id) on delete cascade,
    ticket_number serial,
    type text not null,
    title text not null,
    description text,
    priority text default 'normal',
    status text default 'abierto',
    requested_by uuid references user_profiles (id),
    requested_by_name text,
    requested_by_department text,
    assigned_to uuid references user_profiles (id),
    resolution_time int default 0,
    total_cost numeric(10, 2) default 0,
    history jsonb default '[]',
    created_at timestamp
    with
        time zone default now(),
        updated_at timestamp
    with
        time zone default now(),
        updated_by uuid references user_profiles (id)
);

-- Announcements
create table if not exists announcements (
  id uuid primary key default uuid_generate_v4(),
  institute_id uuid references institutes(id) on delete cascade,
  title text not null,
  content text,
  priority text default 'normal',
  target_roles text[] default '{}',
  author uuid references user_profiles(id),
  author_name text,
  created_at timestamp with time zone default now()
);

-- Calendar Days
create table if not exists calendar_days (
    id uuid primary key default uuid_generate_v4 (),
    institute_id uuid references institutes (id) on delete cascade,
    date date not null,
    slots int default 4,
    is_holiday boolean default false,
    drive_link text,
    unique (institute_id, date)
);

-- Calendar Events
create table if not exists calendar_events (
    id uuid primary key default uuid_generate_v4 (),
    institute_id uuid references institutes (id) on delete cascade,
    date date not null,
    title text not null,
    type text,
    time time,
    link text,
    description text,
    created_at timestamp
    with
        time zone default now()
);

-- ==========================================
-- 3. FUNCTIONS (SECURITY DEFINER + PLPGSQL)
-- ==========================================

-- TRIGGER to automatically create user_profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, display_name, photo_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger definition
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Helper: Check member (Used for Ticket/Dept access, NOT for institute_members itself to avoid loop)
create or replace function is_member_of(_institute_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from institute_members
    where user_id = auth.uid()
    and institute_id = _institute_id
    and status = 'active'
  );
end;
$$ language plpgsql security definer;

-- ==========================================
-- 4. RLS POLICIES (SAFE MODE)
-- ==========================================

-- Institutes
alter table institutes enable row level security;

create policy "Institutes viewable by authenticated" on institutes for
select using (
        auth.role () = 'authenticated'
    );

create policy "Users can register institutes" on institutes for
insert
with
    check (
        auth.role () = 'authenticated'
    );

create policy "Institutes updateable by superadmins" on institutes for
update using (
    auth.role () = 'authenticated'
);

create policy "Institutes deletable by superadmins" on institutes for delete using (
    exists (
        select 1
        from user_profiles
        where
            id = auth.uid ()
            and is_superadmin = true
    )
);

-- User Profiles
alter table user_profiles enable row level security;

create policy "Users can view own profile" on user_profiles for
select using (auth.uid () = id);

create policy "Users can update own profile" on user_profiles for
update using (auth.uid () = id);

-- FALLBACK: Allow users to insert their own profile if trigger fails
create policy "Users can insert own profile" on user_profiles for
insert
with
    check (auth.uid () = id);

-- Allow reading other profiles (needed for picking users, etc)
create policy "Users can view all profiles" on user_profiles for
select using (
        auth.role () = 'authenticated'
    );

-- Institute Members
alter table institute_members enable row level security;

-- STRICT: Only view YOUR OWN rows.
create policy "View own memberships" on institute_members for
select using (user_id = auth.uid ());

-- ALLOW INSERT for Joining
create policy "Users can join" on institute_members for
insert
with
    check (auth.uid () = user_id);

-- Departments
alter table departments enable row level security;

create policy "View departments" on departments for
select using (is_member_of (institute_id));

-- Tickets
alter table tickets enable row level security;

create policy "View tickets" on tickets for
select using (is_member_of (institute_id));

create policy "Create tickets" on tickets for
insert
with
    check (is_member_of (institute_id));

create policy "Manage tickets" on tickets for all using (is_member_of (institute_id));

-- Announcements
alter table announcements enable row level security;

create policy "View announcements" on announcements for
select using (is_member_of (institute_id));

create policy "Manage announcements" on announcements for all using (is_member_of (institute_id));

-- Calendar
alter table calendar_days enable row level security;

alter table calendar_events enable row level security;

create policy "View calendar" on calendar_days for
select using (is_member_of (institute_id));

create policy "Manage calendar" on calendar_days for all using (is_member_of (institute_id));

create policy "View events" on calendar_events for
select using (is_member_of (institute_id));

-- SUM Reservations
create table if not exists sum_reservations (
    id uuid primary key default uuid_generate_v4 (),
    institute_id uuid references institutes (id) on delete cascade not null,
    date date not null,
    slot_index int not null,
    title text,
    user_id uuid references auth.users (id),
    user_name text,
    created_at timestamp
    with
        time zone default now()
);

-- Laptop Carts
create table if not exists laptop_carts (
    id uuid primary key default uuid_generate_v4 (),
    institute_id uuid references institutes (id) on delete cascade not null,
    name text not null,
    location text,
    description text,
    active boolean default true,
    created_at timestamp
    with
        time zone default now()
);

-- Cart Reservations
create table if not exists cart_reservations (
    id uuid primary key default uuid_generate_v4 (),
    institute_id uuid references institutes (id) on delete cascade not null,
    cart_id uuid references laptop_carts (id) on delete cascade not null,
    date date not null,
    slot_index int not null,
    user_id uuid references auth.users (id),
    user_name text,
    comment text,
    created_at timestamp
    with
        time zone default now()
);

-- RLS for new tables
alter table sum_reservations enable row level security;

alter table laptop_carts enable row level security;

alter table cart_reservations enable row level security;

create policy "View SUM" on sum_reservations for
select using (is_member_of (institute_id));

create policy "Manage SUM" on sum_reservations for all using (is_member_of (institute_id));

create policy "View Carts" on laptop_carts for
select using (is_member_of (institute_id));

create policy "Manage Carts" on laptop_carts for all using (is_member_of (institute_id));

create policy "View Cart Reservations" on cart_reservations for
select using (is_member_of (institute_id));

create policy "Manage Cart Reservations" on cart_reservations for all using (is_member_of (institute_id));