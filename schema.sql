-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. RESET SCHEMA (DROP EVERYTHING)
-- ==========================================

-- Drop Trigger FIRST (because it depends on the function)
drop trigger if exists on_auth_user_created on auth.users;

-- Drop Tables (Cascade drops policies and foreign keys)
drop table if exists login_logs cascade;

drop table if exists dual_interactions cascade;

drop table if exists dual_students cascade;

drop table if exists companies cascade;

drop table if exists dual_config cascade;

drop table if exists cart_reservations cascade;

drop table if exists laptop_carts cascade;

drop table if exists sum_reservations cascade;

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
    module_config jsonb default '{}'::jsonb,
    address text,
    website text,
    time_slots jsonb default '[
        {"start": "08:00", "end": "09:00", "label": "1ª Hora"},
        {"start": "09:00", "end": "10:00", "label": "2ª Hora"},
        {"start": "10:00", "end": "11:00", "label": "3ª Hora"},
        {"start": "11:00", "end": "11:30", "label": "Recreo"},
        {"start": "11:30", "end": "12:30", "label": "4ª Hora"},
        {"start": "12:30", "end": "13:30", "label": "5ª Hora"},
        {"start": "13:30", "end": "14:30", "label": "6ª Hora"}
    ]'::jsonb,
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
    department text, -- Target department to handle the ticket
    location text, -- For maintenance
    image_url text,
    stl_url text, -- For 3D
    filament_used numeric(10, 2), -- For 3D
    print_time text, -- For 3D
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

-- Login Logs (Audit)
create table if not exists login_logs (
    id uuid primary key default uuid_generate_v4 (),
    user_id uuid references user_profiles (id),
    email text,
    name text,
    role text,
    type text, -- 'login', 'logout', 'action'
    reason text, -- 'success', 'fail'
    ip text,
    user_agent text,
    institute_id uuid references institutes (id) on delete set null,
    timestamp timestamp
    with
        time zone default now()
);

-- RLS for Login Logs
alter table login_logs enable row level security;

create policy "View logs" on login_logs for
select using (
        exists (
            select 1
            from institute_members
            where
                user_id = auth.uid ()
                and institute_id = login_logs.institute_id
                and 'admin' = any (roles)
        )
        or (auth.uid () = user_id) -- Users see their own logs
        or exists (
            select 1
            from user_profiles
            where
                id = auth.uid ()
                and is_superadmin = true
        )
    );

create policy "Insert logs" on login_logs for
insert
with
    check (auth.uid () = user_id);

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

-- PENDING MEMBERSHIPS
create table if not exists pending_memberships (
    id uuid primary key default uuid_generate_v4 (),
    institute_id uuid references institutes (id) on delete cascade not null,
    email text not null,
    roles text[] default '{}',
    department text,
    created_at timestamp
    with
        time zone default now(),
    unique(institute_id, email)
);

-- RLS for Pending Memberships
alter table pending_memberships enable row level security;

create policy "Manage pending memberships" on pending_memberships for all using (is_admin_of (institute_id));

-- TRIGGER to automatically create user_profile on signup AND check pending memberships
create or replace function handle_new_user()
returns trigger as $$
declare
  pending_record record;
begin
  -- 1. Create Profile
  insert into public.user_profiles (id, email, display_name, photo_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );

  -- 2. Check for pending memberships and add to institutes
  for pending_record in select * from pending_memberships where email = new.email
  loop
    insert into institute_members (user_id, institute_id, roles, department, status)
    values (new.id, pending_record.institute_id, pending_record.roles, pending_record.department, 'active')
    on conflict (user_id, institute_id) do nothing;
    
    -- Optional: Delete pending record after successful join? 
    -- delete from pending_memberships where id = pending_record.id;
    -- Keeping it or deleting it depends on preference. Let's delete it to keep clean.
    delete from pending_memberships where id = pending_record.id;
  end loop;

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

-- Helper: Check admin (Used for managing members)
create or replace function is_admin_of(_institute_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from institute_members
    where user_id = auth.uid()
    and institute_id = _institute_id
    and status = 'active'
    and ('admin' = any(roles) or 'director' = any(roles))
  );
end;
$$ language plpgsql security definer;

-- Institute Members
alter table institute_members enable row level security;

-- VIEW: Allow users to view ALL members of their active institutes
create policy "View institute memberships" on institute_members for
select using (is_member_of (institute_id));

-- ALLOW INSERT for Joining (unchanged)
create policy "Users can join" on institute_members for
insert
with
    check (auth.uid () = user_id);

-- MANAGE: Allow admins to update/delete members, AND superadmins
create policy "Manage memberships" on institute_members for all using (
    is_admin_of (institute_id)
    or exists (
        select 1
        from user_profiles
        where
            id = auth.uid ()
            and is_superadmin = true
    )
);

-- Departments
alter table departments enable row level security;

create policy "View departments" on departments for
select using (is_member_of (institute_id));

create policy "Manage departments" on departments for all using (is_member_of (institute_id));

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

-- ==========================================
-- DUAL MODULE TABLES
-- ==========================================

-- Dual Config
create table if not exists dual_config (
    id uuid primary key default uuid_generate_v4 (),
    institute_id uuid references institutes (id) on delete cascade not null,
    cycles jsonb default '[]'::jsonb,
    levels jsonb default '[]'::jsonb,
    updated_at timestamp with time zone default now(),
    unique(institute_id)
);

-- Companies
create table if not exists companies (
    id uuid primary key default uuid_generate_v4 (),
    institute_id uuid references institutes (id) on delete cascade not null,
    name text not null,
    cif text,
    address text,
    phone text,
    email text,
    contact_name text,
    manager_name text,
    manager_phone text,
    manager_email text,
    tutor_name text,
    tutor_phone text,
    tutor_email text,
    status text default 'none', -- none, negotiating, agreed, declined
    agreement_status text default 'pending', -- pending, signed, expired
    notes text,
    prospector_id uuid references user_profiles (id),
    created_at timestamp
    with
        time zone default now()
);

-- Dual Students
create table if not exists dual_students (
    id uuid primary key default uuid_generate_v4 (),
    institute_id uuid references institutes (id) on delete cascade not null,
    name text not null,
    course text,
    cycle text,
    level text,
    schedule text,
    company_id uuid references companies (id) on delete set null,
    tutor_id uuid references user_profiles (id),
    status text default 'pending', -- pending, assigned, in_process
    possible_company text,
    start_date date,
    end_date date,
    observations text,
    created_at timestamp
    with
        time zone default now()
);

-- Dual Interactions
create table if not exists dual_interactions (
    id uuid primary key default uuid_generate_v4 (),
    institute_id uuid references institutes (id) on delete cascade not null,
    related_id uuid not null, -- company_id or student_id
    related_type text not null, -- 'company' or 'student'
    type text not null, -- visit, call, email, other
    date date not null,
    notes text,
    author uuid references user_profiles (id),
    author_name text,
    created_at timestamp
    with
        time zone default now()
);

-- RLS for Dual Module
alter table dual_config enable row level security;

alter table companies enable row level security;

alter table dual_students enable row level security;

alter table dual_interactions enable row level security;

-- Dual Config Policies
create policy "View Dual Config" on dual_config for
select using (is_member_of (institute_id));

create policy "Manage Dual Config" on dual_config for all using (is_member_of (institute_id));
-- Restricted by UI role check usually, mostly admins/dual team

-- Companies Policies
create policy "View Companies" on companies for
select using (is_member_of (institute_id));

create policy "Manage Companies" on companies for all using (is_member_of (institute_id));

-- Dual Students Policies
create policy "View Dual Students" on dual_students for
select using (is_member_of (institute_id));

create policy "Manage Dual Students" on dual_students for all using (is_member_of (institute_id));

-- Dual Interactions Policies
create policy "View Dual Interactions" on dual_interactions for
select using (is_member_of (institute_id));

create policy "Manage Dual Interactions" on dual_interactions for all using (is_member_of (institute_id));