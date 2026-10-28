import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronRight,
  NotebookPen,
  Star,
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
  Badge,
} from "../components/ui";
import {
  ReferenceCategoryCard,
  SchoolHeading,
  WelcomeCard,
} from "../components/reference";
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
function StudentDashboard({ me, term, navigate, onCreate, onView }: Props) {
  const progress = useQuery({
    queryKey: ["progress", term.id],
    queryFn: () => api<Summary>("/me/progress?termId=" + term.id),
  });
  const recent = useQuery({
    queryKey: ["recent", term.id],
    queryFn: () =>
      api<Page<Activity>>("/activities?termId=" + term.id + "&size=4"),
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
      <WelcomeCard me={me} subtitle={`${s.classroom} เลขที่ ${s.rollNumber}`} />
      <div className="home-quick-actions">
        <button onClick={() => navigate("activities")}>
          <span>
            <NotebookPen size={22} />
          </span>
          จัดการกิจกรรม
        </button>
        <button onClick={() => navigate("favorites")}>
          <span>
            <Star size={22} />
          </span>
          ครูที่ชื่นชอบ
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
      <section className="reference-recent">
        <SectionTitle title="กิจกรรมล่าสุด">
          <button className="text-link" onClick={() => navigate("activities")}>
            เพิ่มเติม
          </button>
        </SectionTitle>
        {recent.isPending ? (
          <Loading />
        ) : recent.error ? (
          <ErrorBox error={recent.error} />
        ) : recent.data?.items.length ? (
          <div className="home-activity-list">
            {recent.data.items.map((a) => (
              <button
                className={"home-activity-row " + a.status.toLowerCase()}
                key={a.id}
                onClick={() => onView(a.id)}
              >
                <div>
                  <strong>{a.title || a.categoryName}</strong>
                  <small>
                    {a.categoryName} · {date(a.activityDate)}
                  </small>
                </div>
                <Badge status={a.status} />
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </section>
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
  onList,
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
        <button className="button secondary" onClick={onList}>
          <NotebookPen size={17} />
          รายการกิจกรรม
        </button>
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
