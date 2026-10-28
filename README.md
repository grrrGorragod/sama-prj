# SAMA — Student Activity Management

- **Frontend**: React + TypeScript (Vite) — `frontend/` (from your friend, unchanged)
- **Backend**: ASP.NET Core 8 Web API — `backend/SamaApi/` (ours; same API the frontend expects)
- **Database**: Supabase PostgreSQL (your friend's tables + `database/*.sql`), evidence files in Supabase Storage

```
Browser ──/api──▶ Vite proxy ──▶ .NET API (127.0.0.1:8080) ──▶ Supabase Postgres + Storage
```

## 1. Database (once)

Supabase → SQL Editor → run, in this order:

1. `database/001_alter_for_sama.sql` — *skip if you already ran it before*
2. `database/002_pp_frontend.sql`

## 2. Backend

Create `backend/SamaApi/appsettings.Local.json` (git-ignored) with your secrets — it overrides `appsettings.json`:

```json
{
  "ConnectionStrings": {
    "Supabase": "Host=...pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.PROJECT_REF;Password=...;SSL Mode=Require;Trust Server Certificate=true"
  },
  "Supabase": {
    "Url": "https://PROJECT_REF.supabase.co",
    "ServiceKey": "service_role key (Project Settings → API Keys)"
  }
}
```

- Leave `Supabase` empty while developing → files go to the local folder `evidence-storage/`.
- The service key is a **server secret**: never put it in the frontend or commit it.

```bash
cd backend/SamaApi
dotnet run
```

First start fills in what is missing: 7 activity categories, this year's requirements and deadline, and classrooms 1/1 … 6/10.

## 3. Create accounts (there is no sign-up page)

CSV files are in `test-data/`. From `backend/SamaApi`:

```bash
dotnet run -- import --teachers ../../test-data/sama-test-teachers.csv --students ../../test-data/sama-test-students.csv
```

- Teachers CSV: `teacher_code, full_name, email, phone, advisor_classroom, password`
- Students CSV: `student_code, full_name, email, classroom, class_number, phone, password`
- Leave `password` empty → a random one is generated and written to `import-passwords-*.csv` (hand out, then delete).
- Existing e-mails are skipped; bad rows are listed and nothing from them is saved.
- Test accounts: `t001@sama.test` … and `s690101@sama.test` …, password `Test@1234`.

## 4. Frontend

```bash
cd frontend
npm install
npm run dev        # http://127.0.0.1:5173
```

## How it works

| Topic | Design |
|---|---|
| Login | e-mail + bcrypt password from table `"User"`; HttpOnly session cookie; CSRF token (`/api/auth/csrf`) required on every POST/PATCH/PUT/DELETE; 10 login attempts/min per IP |
| Roles | `STUDENT` / `TEACHER` on every endpoint; students see only their own activities, teachers only those sent to them and only their advised classroom |
| Status | `DRAFT → PENDING → APPROVED` or `REJECTED` (teacher must write a reason; student can edit and resubmit) |
| Editing conflicts | each activity has a `version`; stale edits get `409` |
| Evidence | JPG/PNG/WEBP/PDF, ≤ 5 MB, ≤ 5 files per activity, content checked (not just the extension); stored in a **private** Supabase Storage bucket, downloaded only through the API after a permission check |
| Choosing the reviewer | student picks any teacher when submitting; favourite teachers are listed first |
| Academic year | "term" = whole academic year (1 May – 30 Apr, e.g. 2569). Semesters can be added later |
| Layers | Controller → Service → Repository → DbContext (EF Core). Domain classes (`Activity`, `User`, …) own the rules |

## Notes

- Cookie sessions are encrypted with keys stored in `backend/SamaApi/.keys/`. Keep that folder on the server (otherwise everyone is logged out after a deploy).
- Set `Auth:CookieSecure` to `true` when the site runs on HTTPS.
- The Playwright tests and the Docker files that came with the frontend assumed the Java backend and demo accounts; they are not updated.
