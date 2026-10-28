import { ChevronRight, Flame } from "lucide-react";
import type { CategoryProgress, Me, Summary } from "../lib/types";
export function PersonAvatar({ square = false }: { square?: boolean }) {
  return (
    <svg
      className={"person-avatar " + (square ? "square" : "")}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="avatar-gradient" x2="0" y2="1">
          <stop stopColor="#c179f6" />
          <stop offset="1" stopColor="#ee73c6" />
        </linearGradient>
      </defs>
      <rect
        width="100"
        height="100"
        rx={square ? 20 : 50}
        fill="url(#avatar-gradient)"
      />
      <rect x="24" y="34" width="52" height="49" rx="5" fill="#ffdbaf" />
      <rect x="21" y="21" width="58" height="24" rx="5" fill="#292929" />
      <ellipse cx="40" cy="61" rx="3.2" ry="4.4" fill="#292929" />
      <ellipse cx="60" cy="61" rx="3.2" ry="4.4" fill="#292929" />
    </svg>
  );
}
export function SchoolHeading() {
  return (
    <div className="school-heading">
      <span className="school-emblem">
        <Flame size={26} fill="#ffb313" strokeWidth={2.5} />
        <i />
      </span>
      <div>
        <strong>โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย ชลบุรี</strong>
        <small>Princess Chulabhorn Science High School Chonburi</small>
      </div>
    </div>
  );
}
export function WelcomeCard({ me, subtitle }: { me: Me; subtitle: string }) {
  return (
    <section className="welcome-card">
      <PersonAvatar />
      <div>
        <span>ยินดีต้อนรับ !</span>
        <h1>{me.fullName}</h1>
        <p>{subtitle}</p>
      </div>
    </section>
  );
}
export function ReferenceCategoryCard({
  category: c,
  onClick,
}: {
  category: CategoryProgress;
  onClick: () => void;
}) {
  const value =
    c.metric === "COUNT" ? c.remaining : Number((c.remaining / 60).toFixed(1));
  return (
    <button
      className={"reference-category " + c.color}
      onClick={onClick}
      aria-label={"เพิ่มกิจกรรม " + c.name}
    >
      <div className="reference-category-art">
        <span
          className={
            "completion-chip " + (c.percent >= 100 ? "is-complete" : "")
          }
        >
          {c.percent.toFixed(1)}% Completed
        </span>
        <i />
        <i />
      </div>
      <div className="reference-category-body">
        <h3>{c.name}</h3>
        <p className={c.remaining === 0 ? "done" : ""}>
          {c.remaining === 0 ? (
            "ครบแล้ว"
          ) : (
            <>
              คงเหลือ <strong>{value}</strong>{" "}
              {c.metric === "COUNT" ? "ครั้ง" : "ชั่วโมง"}
            </>
          )}
        </p>
      </div>
    </button>
  );
}
export function StudentStatistics({ student: s }: { student: Summary }) {
  return (
    <div className="reference-student-statistics">
      <div
        className="student-ring"
        style={{
          background: `conic-gradient(#16c76d ${s.percent}%,#d1d5db 0)`,
        }}
        role="img"
        aria-label={"ความคืบหน้า " + s.percent + " เปอร์เซ็นต์"}
      >
        <div>
          <PersonAvatar />
        </div>
      </div>
      <div className="statistics-identity">
        <h3>{s.studentName}</h3>
        <p>
          {s.classroom} เลขที่ {s.rollNumber}
        </p>
      </div>
      <div className="statistics-summary">
        <div className="approved">
          <strong>{s.percent}%</strong>
          <span>ความคืบหน้าที่อนุมัติแล้ว</span>
        </div>
        <div className="remaining">
          <strong>{Number((100 - s.percent).toFixed(1))}%</strong>
          <span>ยังทำไม่ครบตามเกณฑ์</span>
        </div>
        <div className="rejected">
          <strong>
            {s.rejected} <small>รายการ</small>
          </strong>
          <span>ไม่อนุมัติ / ส่งคืน</span>
        </div>
        <div className="pending">
          <strong>
            {s.pending} <small>รายการ</small>
          </strong>
          <span>ส่งแล้ว</span>
        </div>
        <div className="draft">
          <strong>
            {s.draft} <small>รายการ</small>
          </strong>
          <span>สร้างแล้ว</span>
        </div>
      </div>
      <h4>รายการหมวดกิจกรรมพัฒนาผู้เรียน</h4>
      <div className="statistics-accordions">
        {s.categories.map((c) => (
          <details key={c.categoryId} open>
            <summary>
              {c.name}{" "}
              <span>
                (
                {c.metric === "COUNT"
                  ? c.approvedValue
                  : Number((c.approvedValue / 60).toFixed(1))}
                /
                {c.metric === "COUNT"
                  ? c.target
                  : Number((c.target / 60).toFixed(1))}
                )
              </span>
              <ChevronRight size={16} />
            </summary>
            <div className="statistics-category-grid">
              <div>
                <strong>
                  {c.metric === "COUNT"
                    ? c.approvedValue
                    : Number((c.approvedValue / 60).toFixed(1))}{" "}
                  {c.metric === "COUNT" ? "ครั้ง" : "ชั่วโมง"}
                </strong>
                <span>อนุมัติแล้ว</span>
              </div>
              <div>
                <strong>{c.pendingCount} รายการ</strong>
                <span>ส่งแล้ว</span>
              </div>
              <div>
                <strong>{c.rejectedCount} รายการ</strong>
                <span>ไม่อนุมัติ</span>
              </div>
              <div>
                <strong>
                  {c.metric === "COUNT"
                    ? c.remaining
                    : Number((c.remaining / 60).toFixed(1))}{" "}
                  {c.metric === "COUNT" ? "ครั้ง" : "ชั่วโมง"}
                </strong>
                <span>ยังไม่ได้ทำ</span>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
