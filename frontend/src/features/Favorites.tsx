import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Star, UserCircle2 } from "lucide-react";
import type { Teacher, Page } from "../lib/types";
import { api } from "../lib/api";
import { PersonAvatar } from "../components/reference";
import { Loading, ErrorBox, Empty } from "../components/ui";
export default function Favorites({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const teachers = useQuery({
    queryKey: ["teachers", search, page],
    queryFn: () =>
      api<Page<Teacher>>(
        `/teachers?search=${encodeURIComponent(search)}&page=${page}`,
      ),
  });
  const favorites = useQuery({
    queryKey: ["favorites"],
    queryFn: () => api<Teacher[]>("/me/favorite-teachers"),
  });
  const mutation = useMutation({
    mutationFn: (t: Teacher) =>
      api("/me/favorite-teachers/" + t.id, {
        method: t.favorite ? "DELETE" : "PUT",
      }),
    onSuccess: (_, t) =>
      notify(
        t.favorite ? "นำครูออกจากครูที่ปรึกษาแล้ว" : "เพิ่มครูที่ปรึกษาแล้ว",
      ),
  });
  function teacherRow(t: Teacher) {
    return (
      <article className="reference-teacher-row" key={t.id}>
        {t.favorite ? (
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
        <button
          className={"star-button " + (t.favorite ? "is-favorite" : "")}
          aria-label={
            t.advisor
              ? "ครูที่ปรึกษาประจำห้อง " + t.fullName
              : (t.favorite ? "นำออกจากครูที่ปรึกษา " : "เพิ่มเป็นครูที่ปรึกษา ") +
                t.fullName
          }
          aria-pressed={t.favorite}
          disabled={mutation.isPending || !!t.advisor}
          onClick={() => mutation.mutate(t)}
        >
          <Star size={21} fill={t.favorite ? "currentColor" : "none"} />
        </button>
      </article>
    );
  }
  return (
    <div className="reference-favorites">
      <div className="page-heading centered">
        <h1>ครูที่ปรึกษา</h1>
      </div>
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
      {mutation.error && <ErrorBox error={mutation.error} />}
      <h2>ครูที่ปรึกษา</h2>
      {favorites.isPending ? (
        <Loading />
      ) : favorites.error ? (
        <ErrorBox error={favorites.error} />
      ) : favorites.data?.length ? (
        <div>
          {favorites.data
            .filter((t) => t.fullName.includes(search))
            .map(teacherRow)}
        </div>
      ) : (
        <p className="muted favorite-empty">
          กดดาวข้างชื่อครูเพื่อเพิ่มเป็นครูที่ปรึกษา
        </p>
      )}
      <h2>ครูทั้งหมด</h2>
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
