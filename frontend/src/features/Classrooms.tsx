import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ListFilter, Search, ChevronRight } from "lucide-react";
import type { Room, ClassroomSummary, Summary } from "../lib/types";
import { api, downloadCsv } from "../lib/api";
import { Loading, ErrorBox, Empty, Modal } from "../components/ui";
import { PersonAvatar, StudentStatistics } from "../components/reference";
export default function Classrooms({
  termId,
  notify,
}: {
  termId: string;
  notify: (message: string) => void;
}) {
  const rooms = useQuery({
    queryKey: ["rooms", termId],
    queryFn: () => api<Room[]>("/classrooms?termId=" + termId),
  });
  const [roomId, setRoomId] = useState("");
  const room = rooms.data?.find((r) => r.id === roomId) || rooms.data?.[0];
  const stats = useQuery({
    queryKey: ["classroom", room?.id, termId],
    queryFn: () =>
      api<ClassroomSummary>(
        `/classrooms/${room!.id}/statistics?termId=${termId}`,
      ),
    enabled: !!room,
  });
  const [filter, setFilter] = useState<"incomplete" | "completed">(
    "incomplete",
  );
  const [search, setSearch] = useState("");
  const [student, setStudent] = useState<Summary | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<unknown>();
  const [filterOpen, setFilterOpen] = useState(false);
  const [category, setCategory] = useState("");
  async function download() {
    if (!room) return;
    setDownloading(true);
    setError(undefined);
    try {
      await downloadCsv(room.id, termId);
      notify("ดาวน์โหลดรายงานห้องเรียนแล้ว");
    } catch (e) {
      setError(e);
    } finally {
      setDownloading(false);
    }
  }
  if (rooms.isPending) return <Loading />;
  if (rooms.error) return <ErrorBox error={rooms.error} />;
  const s = stats.data;
  const categories = s?.students[0]?.categories || [];
  const selection = categories.find((c) => c.categoryId === category);
  const rows =
    s?.students.map((u) => {
      if (!category) return u;
      const c = u.categories.find((c) => c.categoryId === category);
      return {
        ...u,
        percent: c?.percent || 0,
        completed: !!c && c.remaining === 0,
      };
    }) || [];
  const complete = rows.filter((u) => u.completed).length;
  const incomplete = rows.length - complete;
  const percent = rows.length ? (complete / rows.length) * 100 : 0;
  const students = rows.filter(
    (u) =>
      u.completed === (filter === "completed") &&
      (u.studentName.includes(search) ||
        u.studentCode.toLowerCase().includes(search.toLowerCase())),
  );
  return (
    <div className="reference-classroom">
      <div className="page-heading centered">
        <h1>แดชบอร์ดห้องเรียน</h1>
        <button
          className={
            "icon-button category-filter-button " + (filterOpen ? "active" : "")
          }
          aria-label="เลือกหมวดกิจกรรมสำหรับสถิติ"
          onClick={() => setFilterOpen(!filterOpen)}
        >
          <ListFilter size={23} />
          <span>{category ? 1 : categories.length}</span>
        </button>
      </div>
      <div className="classroom-controls">
        <label>
          ห้องเรียน
          <select
            aria-label="เลือกห้องเรียน"
            value={room?.id || ""}
            onChange={(e) => {
              setRoomId(e.target.value);
              setStudent(null);
              setCategory("");
            }}
          >
            {rooms.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        {filterOpen && (
          <label>
            หมวดกิจกรรม
            <select
              aria-label="กรองสถิติตามหมวด"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">กิจกรรมทั้งหมด</option>
              {categories.map((c) => (
                <option key={c.categoryId} value={c.categoryId}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {!!error && <ErrorBox error={error} />}{" "}
      {!room ? (
        <Empty
          title="ยังไม่มีห้องเรียนในที่ปรึกษา"
          text="กรุณาติดต่อผู้ดูแลเพื่อตั้งค่าห้องเรียน"
        />
      ) : stats.isPending ? (
        <Loading />
      ) : stats.error ? (
        <ErrorBox error={stats.error} retry={() => void stats.refetch()} />
      ) : (
        s && (
          <>
            <section className="reference-classroom-summary">
              <div
                className="classroom-pie"
                role="img"
                aria-label={`นักเรียนทำกิจกรรมครบ ${Math.round(percent)} เปอร์เซ็นต์`}
                style={{
                  background: `conic-gradient(#03c7d2 ${percent}%,#ff2c76 0)`,
                }}
              >
                <div>
                  <strong>{room.label}</strong>
                  <small>{s.totalStudents} คน</small>
                </div>
              </div>
              <div className="classroom-counts">
                <div className="incomplete">
                  <strong>{incomplete} คน</strong>
                  <span>ไม่เสร็จ</span>
                </div>
                <div className="complete">
                  <strong>{complete} คน</strong>
                  <span>เสร็จแล้ว</span>
                </div>
              </div>
            </section>
            <p className="classroom-category-note">
              {selection
                ? "แสดงผลตามหมวด: " + selection.name
                : `แสดงสถิติจากกิจกรรมทั้งหมด ${categories.length} ประเภท`}
            </p>
            <button
              className="button purple-button classroom-export"
              aria-label="ดาวน์โหลด CSV"
              onClick={() => void download()}
              disabled={downloading}
            >
              <Download size={19} />
              {downloading ? "กำลังดาวน์โหลด…" : "ดาวน์โหลดไฟล์สถิติ"}
            </button>
            <p className="classroom-help">
              รายงาน CSV สรุปทุกหมวดของเทอมที่เลือก
            </p>
            <div
              className="status-tabs classroom-tabs"
              role="tablist"
              aria-label="ผลกิจกรรมของนักเรียน"
            >
              <button
                role="tab"
                aria-selected={filter === "incomplete"}
                className={filter === "incomplete" ? "active" : ""}
                onClick={() => setFilter("incomplete")}
              >
                ยังไม่เสร็จ
              </button>
              <button
                role="tab"
                aria-selected={filter === "completed"}
                className={filter === "completed" ? "active" : ""}
                onClick={() => setFilter("completed")}
              >
                เสร็จแล้ว
              </button>
            </div>
            <div className="search-input classroom-search">
              <Search size={18} />
              <input
                aria-label="ค้นหานักเรียน"
                placeholder="ค้นหาชื่อ หรือรหัสนักเรียน…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {students.length ? (
              <div className="reference-student-list">
                {students.map((u) => (
                  <button
                    key={u.studentId}
                    onClick={() =>
                      setStudent(
                        s.students.find(
                          (original) => original.studentId === u.studentId,
                        ) || u,
                      )
                    }
                  >
                    <PersonAvatar />
                    <div className="student-name">
                      <strong>{u.studentName}</strong>
                      <small>
                        เลขที่ {u.rollNumber} · {u.classroom}
                      </small>
                    </div>
                    <div className="student-completion">
                      <strong>{u.percent.toFixed(2)}%</strong>
                      <span>เสร็จสิ้น</span>
                    </div>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title="ไม่พบนักเรียนในเงื่อนไขนี้"
                text="ลองเปลี่ยนแถบสถานะหรือคำค้นหา"
              />
            )}
          </>
        )
      )}
      {student && (
        <Modal
          variant="page"
          title="สถิตินักเรียน"
          onClose={() => setStudent(null)}
        >
          <div className="modal-body">
            <StudentStatistics student={student} />
          </div>
        </Modal>
      )}
    </div>
  );
}
