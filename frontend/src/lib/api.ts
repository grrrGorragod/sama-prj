export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function authenticationExpired(status: number, path: string) {
  if (status === 401 && path !== "/auth/login")
    window.dispatchEvent(new Event("sama-auth-expired"));
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (options.method && !["GET", "HEAD"].includes(options.method)) {
    const r = await fetch("/api/auth/csrf", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!r.ok) {
      authenticationExpired(r.status, path);
      throw new ApiError(r.status, "ไม่สามารถเชื่อมต่อระบบได้");
    }
    const csrf = await r.json();
    headers.set(csrf.headerName, csrf.token);
  }
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      ...options,
      headers,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      0,
      "เชื่อมต่อระบบไม่ได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์ทำงานอยู่",
    );
  }
  if (!response.ok) {
    authenticationExpired(response.status, path);
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      data.message || "เกิดข้อผิดพลาด กรุณาลองใหม่",
    );
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
export function qs(values: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(values))
    if (v !== undefined && v !== "") p.set(k, String(v));
  return p.toString();
}
export function date(value: string | null, withTime = false) {
  if (!value) return "ยังไม่ระบุ";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Bangkok",
  }).format(new Date(value.length === 10 ? value + "T12:00:00+07:00" : value));
}
export const statusNames = {
  DRAFT: "แบบร่าง",
  PENDING: "รอการตรวจสอบ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ส่งคืน",
};
export async function downloadCsv(roomId: string, termId: string) {
  const r = await fetch(
    `/api/classrooms/${roomId}/statistics.csv?termId=${termId}`,
    { credentials: "same-origin" },
  );
  if (!r.ok) {
    authenticationExpired(r.status, "/statistics.csv");
    const e = await r.json().catch(() => ({}));
    throw new Error(e.message || "ดาวน์โหลดไม่สำเร็จ");
  }
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = "sama-classroom.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
