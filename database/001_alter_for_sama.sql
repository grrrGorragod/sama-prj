-- =====================================================================
-- SAMA — changes needed on top of the existing Supabase schema
-- Run once in: Supabase Dashboard → SQL Editor
-- (safe to run on empty tables; if tables already contain data, tell me first)
-- =====================================================================

-- 1) These keys are shared with "User" (or composite) so they must NOT be identity columns
alter table "Student"          alter column student_id drop identity if exists;
alter table "Teacher"          alter column teacher_id drop identity if exists;
alter table "Favorite_Teacher" alter column student_id drop identity if exists;
alter table "Favorite_Teacher" alter column teacher_id drop identity if exists;

-- 2) Missing columns
alter table "Student" add column if not exists class_number integer;               -- เลขที่
alter table "User"    add column if not exists address text,
                      add column if not exists photo   text;                         -- โปรไฟล์
alter table "Activities"
  add column if not exists start_time time,
  add column if not exists end_time   time,
  add column if not exists hours      real not null default 0;
alter table "Activities" alter column activity_date set not null;

-- status per history row → needed for the timeline (สร้างแล้ว → ส่งแล้ว → อนุมัติ)
alter table "Activities_History" add column if not exists status varchar not null default 'Draft';
alter table "Activities_History" alter column status drop default;

-- 3) Data integrity
alter table "User" add constraint user_email_key unique (email);
alter table "User" add constraint user_role_chk check (role in ('student', 'teacher'));
alter table "Activities" add constraint activities_status_chk
  check (status in ('Draft', 'Submitted', 'Approved', 'Rejected'));
alter table "Activites_Requirement" add constraint requirement_cat_year_key unique (catagory_id, academic_year);
alter table "Activites_Deadlines"   add constraint deadline_year_key unique (academic_year);

-- 4) Block the public Supabase REST API (anon key). The .NET API connects as the DB owner and is not affected.
alter table "User"                  enable row level security;
alter table "Student"               enable row level security;
alter table "Teacher"               enable row level security;
alter table "Classroom"             enable row level security;
alter table "Favorite_Teacher"      enable row level security;
alter table "Activites_Catagories"  enable row level security;
alter table "Activites_Requirement" enable row level security;
alter table "Activites_Deadlines"   enable row level security;
alter table "Activities"            enable row level security;
alter table "Activities_History"    enable row level security;
