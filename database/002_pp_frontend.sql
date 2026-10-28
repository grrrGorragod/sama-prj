-- =====================================================================
-- SAMA — database changes for the new web client (run AFTER 001_alter_for_sama.sql)
-- Supabase Dashboard → SQL Editor → New query → paste → Run
-- Safe to run more than once.
-- =====================================================================

-- 1) Statuses become DRAFT / PENDING / APPROVED / REJECTED (what the web client uses)
alter table "Activities"         drop constraint if exists activities_status_chk;
alter table "Activities_History" drop constraint if exists history_status_chk;

update "Activities" set status = case status
  when 'Draft' then 'DRAFT' when 'Submitted' then 'PENDING'
  when 'Approved' then 'APPROVED' when 'Rejected' then 'REJECTED' else status end;
update "Activities_History" set status = case status
  when 'Draft' then 'DRAFT' when 'Submitted' then 'PENDING'
  when 'Approved' then 'APPROVED' when 'Rejected' then 'REJECTED' else status end;

alter table "Activities"         add constraint activities_status_chk check (status in ('DRAFT','PENDING','APPROVED','REJECTED'));
alter table "Activities_History" add constraint history_status_chk    check (status in ('DRAFT','PENDING','APPROVED','REJECTED'));

-- 2) Activities: optimistic-lock version, evidence counter, duration in minutes, academic year
alter table "Activities"
  add column if not exists version            bigint  not null default 0,
  add column if not exists evidence_revision  integer not null default 0,
  add column if not exists duration_minutes   integer not null default 0,
  add column if not exists academic_year      integer;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'Activities' and column_name = 'hours') then
    execute 'update "Activities" set duration_minutes = round(hours * 60)::int where duration_minutes = 0 and hours > 0';
    execute 'alter table "Activities" drop column hours';
  end if;
end $$;

update "Activities" set academic_year = case
    when activity_date is not null and extract(month from activity_date) >= 5 then extract(year from activity_date)::int + 543
    when activity_date is not null                                             then extract(year from activity_date)::int + 542
    when extract(month from created_at) >= 5                                    then extract(year from created_at)::int + 543
    else extract(year from created_at)::int + 542 end
where academic_year is null;
alter table "Activities" alter column academic_year set not null;

-- a draft may be saved before a date is chosen
alter table "Activities" alter column activity_date drop not null;

-- 3) History: previous status + running number per activity
alter table "Activities_History"
  add column if not exists sequence    integer,
  add column if not exists from_status varchar;

with ordered as (
  select history_id,
         row_number() over (partition by activity_id order by change_at, history_id) as rn,
         lag(status)  over (partition by activity_id order by change_at, history_id) as prev
  from "Activities_History")
update "Activities_History" h
   set sequence = o.rn, from_status = o.prev
  from ordered o
 where h.history_id = o.history_id and h.sequence is null;

alter table "Activities_History" alter column sequence set not null;
alter table "Activities_History" drop constraint if exists history_activity_sequence_key;
alter table "Activities_History" add constraint history_activity_sequence_key unique (activity_id, sequence);

-- 4) Categories need a code and a colour for the UI (the API fills them in on first start)
alter table "Activites_Catagories"
  add column if not exists code  varchar,
  add column if not exists color varchar;

-- 5) Teachers: department (optional)
alter table "Teacher" add column if not exists department varchar not null default '';

-- 6) Classrooms 1/1 … 6/10: advisor can be assigned later; the same room name may repeat every year
alter table "Classroom" alter column advisor_teacher_id drop not null;
alter table "Classroom" drop constraint if exists "Classroom_classroom_name_key";
alter table "Classroom" drop constraint if exists classroom_name_year_key;
alter table "Classroom" add constraint classroom_name_year_key unique (classroom_name, academic_year);

-- 7) One student code per student, one roll number per classroom
create unique index if not exists student_code_key on "Student" (student_code);
create unique index if not exists student_roll_key on "Student" (classroom_id, class_number);

-- 8) Evidence files: only metadata is in the database, the file itself is in Supabase Storage
create table if not exists "Activity_Attachments" (
  attachment_id    bigint generated always as identity primary key,
  activity_id      bigint       not null references "Activities"(activity_id) on delete cascade,
  client_upload_id uuid         not null,
  original_name    varchar(200) not null,
  content_type     varchar(100) not null,
  size_bytes       bigint       not null check (size_bytes > 0 and size_bytes <= 5242880),
  sha256           varchar(64)  not null,
  storage_path     text         not null,
  uploaded_at      timestamptz  not null,
  unique (activity_id, client_upload_id)
);
create index if not exists ix_attachments_activity on "Activity_Attachments" (activity_id);
alter table "Activity_Attachments" enable row level security;

-- private bucket: nobody can read files with the public anon key, only the .NET server (service key)
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false)
on conflict (id) do nothing;
