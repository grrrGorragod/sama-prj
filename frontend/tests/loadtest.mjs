// Load test: N students use the system at the same time.
//   node tests/loadtest.mjs --base http://127.0.0.1:8080 --users users.csv --count 30 --duration 60
// Options: --think 8000 (average pause between actions, ms)   --reuse (share accounts when --count > number of accounts)
// users.csv: header "email,password", one student per line (at least --count rows).
// Needs Node 18+. No packages to install. Every activity it creates is titled "LOADTEST ...".
import fs from "node:fs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const BASE = arg("base", "http://127.0.0.1:8080").replace(/\/$/, "");
const COUNT = Number(arg("count", 30));
const DURATION = Number(arg("duration", 60)) * 1000; // seconds of activity after everyone is logged in
const LOGIN_GAP = Number(arg("login-gap", 0)); // ms between logins (use ~6500 if the server still limits logins to 10/min)
const THINK = Number(arg("think", 1500)); // average pause between actions in ms (a real student pauses much longer than 1.5 s)
const REUSE = process.argv.includes("--reuse"); // let several virtual students share the same account (when you have fewer accounts than --count)
const usersFile = arg("users");
if (!usersFile) { console.log("ต้องระบุ --users users.csv (คอลัมน์ email,password)"); process.exit(2); }

const rows = fs.readFileSync(usersFile, "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const header = rows[0].toLowerCase().split(",");
const users = rows.slice(1).map((l) => {
  const c = l.split(",");
  return { email: c[header.indexOf("email")].trim(), password: c[header.indexOf("password")].trim() };
});
if (users.length < COUNT && !REUSE) { console.log(`ใน ${usersFile} มี ${users.length} บัญชี แต่ต้องการ ${COUNT}`); process.exit(2); }

const stats = {}; // label -> { times: [], errors: 0, codes: {} }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const items = (x) => (Array.isArray(x) ? x : x?.items ?? []);

class Client {
  constructor() { this.cookies = new Map(); this.csrf = ""; }
  async call(label, method, path, body) {
    const headers = { Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ") };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (method !== "GET") headers["X-CSRF-TOKEN"] = this.csrf;
    const t0 = performance.now();
    let res, data = null;
    try {
      res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      for (const sc of res.headers.getSetCookie?.() ?? []) {
        const [kv] = sc.split(";"); const i = kv.indexOf("=");
        this.cookies.set(kv.slice(0, i), kv.slice(i + 1));
      }
      const text = await res.text();
      try { data = JSON.parse(text); } catch { /* not json */ }
    } catch { /* network error */ }
    const ms = performance.now() - t0;
    const s = (stats[label] ??= { times: [], errors: 0, codes: {} });
    s.times.push(ms);
    const code = res?.status ?? "ERR";
    s.codes[code] = (s.codes[code] ?? 0) + 1;
    if (!res || !res.ok) s.errors++;
    return { ok: !!res?.ok, status: code, data };
  }
  async refreshCsrf() { const r = await this.call("csrf", "GET", "/api/auth/csrf"); this.csrf = r.data?.token ?? ""; }
}

const rand = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rand(a.length)];
const pad = (n) => String(n).padStart(2, "0");

async function student(index) {
  const u = users[index % users.length];
  await sleep(index * LOGIN_GAP);
  const c = new Client();
  await c.refreshCsrf();
  const login = await c.call("login", "POST", "/api/auth/login", { email: u.email, password: u.password });
  if (!login.ok) { console.log(`ล็อกอินไม่สำเร็จ ${u.email} (HTTP ${login.status})`); return null; }
  await c.refreshCsrf(); // the CSRF token is tied to the signed-in user
  return c;
}

async function work(c, stopAt) {
  const terms = (await c.call("terms", "GET", "/api/terms")).data ?? [];
  const term = terms[terms.length - 1] ?? terms[0];
  if (!term) return;
  const cats = (await c.call("categories", "GET", `/api/activity-categories?termId=${term.id}`)).data ?? [];
  const teachers = items((await c.call("teachers", "GET", "/api/teachers")).data);
  if (!cats.length || !teachers.length) return;

  while (Date.now() < stopAt) {
    const cat = pick(cats);
    const start = new Date(term.startsOn + "T00:00:00Z");
    const day = new Date(start.getTime() + rand(60) * 86400000).toISOString().slice(0, 10);
    const h = 6 + rand(8);
    const body = {
      termId: term.id, categoryId: cat.id, title: `LOADTEST ${Date.now()}`, description: "ทดสอบระบบ",
      activityDate: day, startTime: `${pad(h)}:00:00`, endTime: `${pad(h + 1)}:00:00`,
    };
    const created = await c.call("create activity", "POST", "/api/activities", body);
    if (created.ok) {
      const a = created.data;
      const edited = await c.call("edit activity", "PATCH", `/api/activities/${a.id}`,
        { ...body, description: "ทดสอบระบบ (แก้ไข)", expectedVersion: a.version });
      if (edited.ok) await c.call("submit activity", "POST", `/api/activities/${a.id}/submit`,
        { reviewerId: pick(teachers).id, expectedVersion: edited.data.version });
    }
    await c.call("list activities", "GET", `/api/activities?termId=${term.id}&page=0&size=12`);
    await c.call("my progress", "GET", `/api/me/progress?termId=${term.id}`);
    await sleep(THINK / 2 + rand(THINK)); // a person does not click every millisecond
  }
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

console.log(`เริ่มทดสอบ: ${COUNT} คน พร้อมกัน, ${DURATION / 1000} วินาที, เซิร์ฟเวอร์ ${BASE}`);
const clients = (await Promise.all(Array.from({ length: COUNT }, (_, i) => student(i)))).filter(Boolean);
console.log(`ล็อกอินสำเร็จ ${clients.length}/${COUNT} คน — เริ่มใช้งานพร้อมกัน`);
const t0 = Date.now();
const stopAt = t0 + DURATION;
await Promise.all(clients.map((c) => work(c, stopAt)));
const secs = (Date.now() - t0) / 1000;

console.log(`\n${"request".padEnd(18)}${"count".padStart(7)}${"err".padStart(6)}${"avg".padStart(8)}${"p50".padStart(8)}${"p95".padStart(8)}${"max".padStart(8)}   (ms)`);
let total = 0, errors = 0;
for (const [label, s] of Object.entries(stats)) {
  const t = [...s.times].sort((a, b) => a - b);
  total += t.length; errors += s.errors;
  const avg = t.reduce((a, b) => a + b, 0) / t.length;
  console.log(`${label.padEnd(18)}${String(t.length).padStart(7)}${String(s.errors).padStart(6)}${avg.toFixed(0).padStart(8)}${pct(t, 0.5).toFixed(0).padStart(8)}${pct(t, 0.95).toFixed(0).padStart(8)}${t[t.length - 1].toFixed(0).padStart(8)}   ${JSON.stringify(s.codes)}`);
}
console.log(`\nรวม ${total} requests, error ${errors} (${((errors / total) * 100).toFixed(1)}%), ${(total / secs).toFixed(1)} req/s`);
