import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, UserCircle2 } from "lucide-react";
import type { Teacher, Page } from "../lib/types";
import { api } from "../lib/api";
import { PersonAvatar } from "../components/reference";
import { Loading, ErrorBox, Empty } from "../components/ui";
export default function Favorites() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const teachers = useQuery({
    queryKey: ["teachers", search, page],
    queryFn: () =>
      api<Page<Teacher>>(
        `/teachers?search=${encodeURIComponent(search)}&page=${page}`,
      ),
  });
  const advisor = useQuery({
    queryKey: ["advisor"],
    queryFn: () => api<Teacher[]>("/me/favorite-teachers"),
  });
  function teacherRow(t: Teacher) {
    return (
      <article className="reference-teacher-row" key={t.id}>
        {t.advisor ? (
          <PersonAvatar />
        ) : (
          <UserCircle2
            className="teacher-placeholder"
            size={34}
            fill="#9197a3"
            color="white"
          />
        )}
        <div>
          <h3>
            {t.fullName}
            {t.advisor && <span className="advisor-badge">ประจำห้อง</span>}
          </h3>
          <small>{t.department}</small>
        </div>
      </article>
    );
  }
  return (
    <div className="reference-favorites">
      <div className="page-heading centered">
        <h1>ครูที่ปรึกษา</h1>
      </div>
      <h2>ครูที่ปรึกษาประจำห้อง</h2>
      {advisor.isPending ? (
        <Loading />
      ) : advisor.error ? (
        <ErrorBox error={advisor.error} />
      ) : advisor.data?.length ? (
        <div>{advisor.data.map(teacherRow)}</div>
      ) : (
        <p className="muted favorite-empty">
          ห้องเรียนของคุณยังไม่มีครูที่ปรึกษา
        </p>
      )}
      <h2>ค้นหาครู</h2>
      <div className="search-input">
        <Search size={19} />
        <input
          aria-label="ค้นหาชื่อครู"
          placeholder="ค้นหาชื่อครู…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      </div>
      {teachers.isPending ? (
        <Loading />
      ) : teachers.error ? (
        <ErrorBox error={teachers.error} />
      ) : teachers.data?.items.length ? (
        <>
          <div>{teachers.data.items.map(teacherRow)}</div>
          {teachers.data.totalPages > 1 && (
            <div className="pagination">
              <button
                className="button secondary"
                disabled={!page}
                onClick={() => setPage(page - 1)}
              >
                ก่อนหน้า
              </button>
              <span>
                {page + 1}/{teachers.data.totalPages}
              </span>
              <button
                className="button secondary"
                disabled={page + 1 >= teachers.data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                ถัดไป
              </button>
            </div>
          )}
        </>
      ) : (
        <Empty title="ไม่พบครูที่ค้นหา" text="ลองค้นหาด้วยชื่ออื่น" />
      )}
    </div>
  );
}
