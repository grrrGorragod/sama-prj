import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronRight,
  NotebookPen,
  Plus,
  Users,
  ClipboardCheck,
} from "lucide-react";
import type {
  Me,
  Term,
  Summary,
  Page,
  Activity,
  Room,
  ClassroomSummary,
} from "../lib/types";
import { api, date } from "../lib/api";
import {
  Loading,
  ErrorBox,
  SectionTitle,
  Empty,
} from "../components/ui";
import {
  ProgressBar,
  ReferenceCategoryCard,
  SchoolHeading,
  WelcomeCard,
} from "../components/reference";

function UserStarIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-user-star"
    >
      <path d="M16.051 12.616a1 1 0 0 1 1.909.024l.737 1.452a1 1 0 0 0 .737.535l1.634.256a1 1 0 0 1 .588 1.806l-1.172 1.168a1 1 0 0 0-.282.866l.259 1.613a1 1 0 0 1-1.541 1.134l-1.465-.75a1 1 0 0 0-.912 0l-1.465.75a1 1 0 0 1-1.539-1.133l.258-1.613a1 1 0 0 0-.282-.866l-1.156-1.153a1 1 0 0 1 .572-1.822l1.633-.256a1 1 0 0 0 .737-.535z" />
      <path d="M8 15H7a4 4 0 0 0-4 4v2" />
      <circle cx="10" cy="7" r="4" />
    </svg>
  );
}


type Navigate = (
  route: "activities" | "reviews" | "classrooms" | "categories" | "favorites",
) => void;
type Props = {
  me: Me;
  term: Term;
  navigate: Navigate;
  onCreate: (categoryId?: string) => void;
  onView: (id: string) => void;
};
export default function Dashboard(props: Props) {
  return props.me.role === "STUDENT" ? (
    <StudentDashboard {...props} />
  ) : (
    <TeacherDashboard {...props} />
  );
}
function StudentDashboard({ me, term, navigate, onCreate }: Props) {
  const progress = useQuery({
    queryKey: ["progress", term.id],
    queryFn: () => api<Summary>("/me/progress?termId=" + term.id),
  });

  if (progress.isPending) return <Loading />;
  if (progress.error)
    return (
      <ErrorBox error={progress.error} retry={() => void progress.refetch()} />
    );
  const s = progress.data;
  const days = Math.max(
    0,
    Math.ceil(
      (new Date(term.submissionDeadline).getTime() - Date.now()) / 86400000,
    ),
  );
  return (
    <div className="reference-home">
      <SchoolHeading />
      <WelcomeCard me={me} subtitle={`ชั้น ${s.classroom} เลขที่ ${s.rollNumber}`} />
      <div className="home-quick-actions">
        <button onClick={() => navigate("activities")}>
          <span>
            <NotebookPen size={22} />
          </span>
          จัดการกิจกรรม
        </button>
        <button onClick={() => navigate("favorites")}>
          <span>
            <UserStarIcon size={22} />
          </span>
          ครูที่ปรึกษา
        </button>
        <button className="desktop-add-action" onClick={() => onCreate()}>
          <span>
            <Plus size={22} />
          </span>
          บันทึกกิจกรรม
        </button>
      </div>
      <section className="reference-deadline">
        <span className="deadline-icon">
          <CalendarDays size={26} />
        </span>
        <div>
          <h2>วันส่งกิจกรรมวันสุดท้าย</h2>
          <p>วันที่ : {date(term.submissionDeadline)}</p>
        </div>
        <strong>
          <span>{days ? "เหลือเวลา" : "ครบกำหนด"}</span>
          {days} วัน
        </strong>
      </section>
      {!s.configured && (
        <div className="notice">ยังไม่ได้ตั้งค่าเกณฑ์ของเทอมนี้</div>
      )}
      {s.configured && (
        <section
          className={
            "reference-overall" + (s.percent >= 100 ? " is-complete" : "")
          }
        >
          <div className="overall-head">
            <h2>ความคืบหน้ารวม</h2>
            <strong>{Number(s.percent.toFixed(1))}%</strong>
          </div>
          <ProgressBar value={s.percent} label="ความคืบหน้ารวม" />
          <p>
            อนุมัติแล้ว {s.approved} · ส่งแล้ว {s.pending} · สร้างแล้ว {s.draft}{" "}
            รายการ
          </p>
        </section>
      )}
      <SectionTitle title="สถิติการทำกิจกรรม">
        <button className="text-link" onClick={() => navigate("categories")}>
          เพิ่มเติม
        </button>
      </SectionTitle>
      <div className="home-category-scroll">
        {s.categories.map((c) => (
          <ReferenceCategoryCard
            key={c.categoryId}
            category={c}
            onClick={() => onCreate(c.categoryId)}
          />
        ))}
      </div>
    </div>
  );
}
function TeacherDashboard({ me, term, navigate, onView }: Props) {
  const pending = useQuery({
    queryKey: ["pending", term.id],
    queryFn: () =>
      api<Page<Activity>>(
        "/reviews?termId=" + term.id + "&status=PENDING&size=8",
      ),
  });
  const rooms = useQuery({
    queryKey: ["rooms", term.id],
    queryFn: () => api<Room[]>("/classrooms?termId=" + term.id),
  });
  const room = rooms.data?.[0];
  const stats = useQuery({
    queryKey: ["classroom", room?.id, term.id],
    queryFn: () =>
      api<ClassroomSummary>(
        `/classrooms/${room!.id}/statistics?termId=${term.id}`,
      ),
    enabled: !!room,
  });
  return (
    <div className="reference-home teacher-home">
      <SchoolHeading />
      <WelcomeCard me={me} subtitle={me.email} />
      <div className="teacher-home-actions">
        <button
          className="button secondary"
          onClick={() => navigate("classrooms")}
        >
          <Users size={18} />
          แดชบอร์ดห้องเรียน
        </button>
        <button
          className="button secondary"
          onClick={() => navigate("reviews")}
        >
          <ClipboardCheck size={18} />
          ตรวจรายการค้าง
        </button>
      </div>
      <SectionTitle title={`รายการค้างตรวจ (${pending.data?.total ?? 0})`}>
        <button className="text-link" onClick={() => navigate("reviews")}>
          เพิ่มเติม
        </button>
      </SectionTitle>
      {pending.isPending ? (
        <Loading />
      ) : pending.error ? (
        <ErrorBox error={pending.error} />
      ) : pending.data?.items.length ? (
        <div className="pending-review-list">
          {pending.data.items.map((a) => (
            <button key={a.id} onClick={() => onView(a.id)}>
              <div>
                <strong>{a.studentName}</strong>
                <small>{a.categoryName}</small>
              </div>
              <ChevronRight size={22} />
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title="ไม่มีรายการค้างตรวจ"
          text="กิจกรรมใหม่ที่นักเรียนส่งให้คุณจะแสดงที่นี่"
        />
      )}
      {stats.data && (
        <section className="teacher-classroom-shortcut">
          <div>
            <Users size={24} />
            <h2>ห้องเรียนในที่ปรึกษา {room?.label}</h2>
          </div>
          <p>
            <strong>{stats.data.completedStudents}</strong> คน ทำกิจกรรมครบแล้ว
            จาก {stats.data.totalStudents} คน
          </p>
          <button
            className="button purple-button"
            onClick={() => navigate("classrooms")}
          >
            ดูสถิติห้องเรียน
            <ChevronRight size={18} />
          </button>
        </section>
      )}
    </div>
  );
}
export function Categories({
  term,
  onCreate,
}: {
  term: Term;
  onCreate: (categoryId?: string) => void;
  onList: () => void;
}) {
  const progress = useQuery({
    queryKey: ["progress", term.id],
    queryFn: () => api<Summary>("/me/progress?termId=" + term.id),
  });
  return (
    <div className="reference-categories-page">
      <div className="page-heading">
        <div>
          <h1>กิจกรรม</h1>
          <p>Activities</p>
        </div>
      </div>
      <h2 className="category-section-title">กิจกรรมพัฒนาผู้เรียน</h2>
      {progress.isPending ? (
        <Loading />
      ) : progress.error ? (
        <ErrorBox error={progress.error} />
      ) : (
        <div className="reference-category-grid">
          {progress.data.categories.map((c) => (
            <ReferenceCategoryCard
              key={c.categoryId}
              category={c}
              onClick={() => onCreate(c.categoryId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}