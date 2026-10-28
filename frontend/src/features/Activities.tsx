import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search,
  Plus,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Send,
} from "lucide-react";
import type { Activity, Page, Category, Status } from "../lib/types";
import { api, ApiError, qs, date } from "../lib/api";
import { Loading, ErrorBox, Empty, Badge, Modal } from "../components/ui";
export default function Activities({
  review,
  termId,
  categories,
  onCreate,
  onView,
  notify,
}: {
  review: boolean;
  termId: string;
  categories: Category[];
  onCreate: () => void;
  onView: (id: string) => void;
  notify: (message: string) => void;
}) {
  const [status, setStatus] = useState<Status | "">(review ? "PENDING" : "");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Activity[]>([]);
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: [
      "activities",
      review,
      termId,
      status,
      category,
      search,
      page,
      from,
      to,
    ],
    queryFn: () =>
      api<Page<Activity>>(
        (review ? "/reviews?" : "/activities?") +
          qs({
            termId,
            status,
            categoryId: category,
            search,
            page,
            size: 12,
            fromDate: from,
            toDate: to,
          }),
      ),
  });
  const mutation = useMutation({
    mutationFn: () =>
      api("/reviews/bulk", {
        method: "POST",
        body: JSON.stringify({
          items: selected.map((a) => ({
            activityId: a.id,
            expectedVersion: a.version,
          })),
          decision,
          reason,
        }),
      }),
    onSuccess: () => {
      notify(
        decision === "APPROVE"
          ? "อนุมัติกิจกรรมเรียบร้อยแล้ว"
          : "ส่งคืนกิจกรรมเรียบร้อยแล้ว",
      );
      setSelected([]);
      setDecision(null);
      setReason("");
      setNotice("");
      setPage(0);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setSelected([]);
        setDecision(null);
        setReason("");
        setNotice("รายการเปลี่ยนแปลงแล้ว กรุณาเลือกจากข้อมูลล่าสุดใหม่");
      }
      void query.refetch();
    },
  });
  useEffect(() => {
    if (query.isSuccess && page > 0 && page >= query.data.totalPages) {
      setPage(Math.max(0, query.data.totalPages - 1));
      setSelected([]);
      setDecision(null);
    }
  }, [query.isSuccess, query.data?.totalPages, page]);
  function reset() {
    setPage(0);
    setSelected([]);
    setNotice("");
  }
  const items = query.data?.items || [];
  const reviewable = items.filter((a) => a.status === "PENDING");
  function toggle(a: Activity) {
    setNotice("");
    setSelected((s) =>
      s.some((x) => x.id === a.id) ? s.filter((x) => x.id !== a.id) : [...s, a],
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{review ? "Review Activities" : ""}</span>
          <h1>{review ? "ตรวจกิจกรรม" : "รายการกิจกรรม"}</h1>
          <p>
            {review
              ? "ตรวจสอบและให้คำแนะนำกับทุกประสบการณ์ของนักเรียน"
              : "ทุกสิ่งที่ได้ลงมือทำ บันทึกไว้ในที่เดียว"}
          </p>
        </div>
        {!review && (
          <button className="button primary" onClick={onCreate}>
            <Plus size={18} />
            บันทึกกิจกรรม
          </button>
        )}
      </div>
      <section className="panel activities-panel">
        {notice && (
          <div className="form-note" role="status">
            {notice}
          </div>
        )}
        {review ? (
          <>
            <div
              className="status-tabs review-main-tabs"
              role="tablist"
              aria-label="การตรวจงาน"
            >
              <button
                role="tab"
                aria-selected={status === "PENDING"}
                className={status === "PENDING" ? "active" : ""}
                onClick={() => {
                  setStatus("PENDING");
                  reset();
                }}
              >
                ยังไม่ได้ตรวจ
              </button>
              <button
                role="tab"
                aria-selected={status !== "PENDING"}
                className={status !== "PENDING" ? "active" : ""}
                onClick={() => {
                  setStatus("APPROVED");
                  reset();
                }}
              >
                ประวัติการตรวจ
              </button>
            </div>
            {status !== "PENDING" && (
              <div
                className="status-tabs history-status-tabs"
                role="tablist"
                aria-label="ผลการตรวจ"
              >
                {(["APPROVED", "REJECTED"] as const).map((s) => (
                  <button
                    key={s}
                    role="tab"
                    aria-selected={status === s}
                    className={status === s ? "active" : ""}
                    onClick={() => {
                      setStatus(s);
                      reset();
                    }}
                  >
                    {s === "APPROVED" ? "อนุมัติแล้ว" : "ส่งคืน"}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div
            className="status-tabs student-status-tabs"
            role="tablist"
            aria-label="สถานะกิจกรรม"
          >
            {(
              [
                { id: "", label: "ทั้งหมด" },
                { id: "DRAFT", label: "ยังไม่ส่ง" },
                { id: "PENDING", label: "ส่งแล้ว" },
                { id: "APPROVED", label: "ตรวจแล้ว" },
                { id: "REJECTED", label: "ไม่ผ่าน" },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={status === s.id}
                className={
                  (status === s.id ? "active " : "") +
                  (s.id || "all").toLowerCase()
                }
                onClick={() => {
                  setStatus(s.id);
                  reset();
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        <div className="filter-row">
          <div className="search-input">
            <Search size={18} />
            <input
              aria-label="ค้นหากิจกรรม"
              value={search}
              placeholder={
                review ? "ค้นหาชื่อนักเรียน หรือกิจกรรม…" : "ค้นหาชื่อกิจกรรม…"
              }
              onChange={(e) => {
                setSearch(e.target.value);
                reset();
              }}
            />
          </div>
          <select
            aria-label="กรองหมวดกิจกรรม"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              reset();
            }}
          >
            <option value="">ทุกหมวดกิจกรรม</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            className={"button subtle " + (filters ? "selected" : "")}
            onClick={() => setFilters(!filters)}
          >
            <SlidersHorizontal size={17} />
            ช่วงวันที่
          </button>
        </div>
        {filters && (
          <div className="date-filters">
            <label>
              ตั้งแต่วันที่
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  reset();
                }}
              />
            </label>
            <span>—</span>
            <label>
              ถึงวันที่
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  reset();
                }}
              />
            </label>
            <button
              className="text-link"
              onClick={() => {
                setFrom("");
                setTo("");
                reset();
              }}
            >
              ล้างวันที่
            </button>
          </div>
        )}
        {review && status === "PENDING" && !!items.length && (
          <div className="selection-heading">
            <label className="check-label">
              <input
                type="checkbox"
                checked={
                  reviewable.length > 0 &&
                  reviewable.every((a) => selected.some((s) => s.id === a.id))
                }
                onChange={(e) =>
                  setSelected(e.target.checked ? reviewable : [])
                }
              />
              เลือกทั้งหมดในหน้านี้
            </label>
            <small>ครั้งละไม่เกิน 50 รายการ</small>
          </div>
        )}
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorBox error={query.error} retry={() => void query.refetch()} />
        ) : !items.length ? (
          <Empty
            title={
              search || category || status
                ? "ไม่พบกิจกรรมในเงื่อนไขนี้"
                : "ยังไม่มีกิจกรรม"
            }
            text={
              review
                ? "เมื่อมีงานที่ตรงเงื่อนไข รายการจะแสดงที่นี่"
                : "เปลี่ยนตัวกรอง หรือเริ่มบันทึกกิจกรรมใหม่"
            }
            action={
              !review && (
                <button className="button secondary" onClick={onCreate}>
                  <Plus size={17} />
                  เพิ่มกิจกรรม
                </button>
              )
            }
          />
        ) : (
          <>
            <div
              className={
                review ? "reference-review-list" : "reference-activity-list"
              }
            >
              {items.map((a) => (
                <article
                  key={a.id}
                  className={
                    (review ? "review-entry" : "activity-entry") +
                    " " +
                    a.status.toLowerCase() +
                    (selected.some((s) => s.id === a.id) ? " selected" : "")
                  }
                >
                  {review && (
                    <input
                      type="checkbox"
                      aria-label={"เลือก " + a.title + " ของ " + a.studentName}
                      disabled={a.status !== "PENDING"}
                      checked={selected.some((s) => s.id === a.id)}
                      onChange={() => toggle(a)}
                    />
                  )}
                  <button className="table-title" onClick={() => onView(a.id)}>
                    <span>
                      <strong>
                        {review ? a.studentName : a.title || a.categoryName}
                      </strong>
                      <small>
                        {review
                          ? a.categoryName
                          : "สร้างเมื่อ: " + date(a.createdAt, true)}
                      </small>
                      {!review && (
                        <span className="entry-category">{a.categoryName}</span>
                      )}
                    </span>
                    <span className="entry-meta">
                      <Badge status={a.status} />
                      <ChevronRight size={20} />
                    </span>
                  </button>
                </article>
              ))}
            </div>
            <div className="pagination">
              <span>
                แสดง {page * 12 + 1}–{page * 12 + items.length} จาก{" "}
                {query.data?.total} รายการ
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label="หน้าก่อนหน้า"
                  disabled={page === 0}
                  onClick={() => {
                    setPage(page - 1);
                    setSelected([]);
                  }}
                >
                  <ChevronLeft size={19} />
                </button>
                <span>
                  {page + 1} / {query.data?.totalPages || 1}
                </span>
                <button
                  className="icon-button"
                  aria-label="หน้าถัดไป"
                  disabled={page + 1 >= (query.data?.totalPages || 1)}
                  onClick={() => {
                    setPage(page + 1);
                    setSelected([]);
                  }}
                >
                  <ChevronRight size={19} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      {selected.length > 0 && (
        <div className="bulk-bar">
          <span>
            <Check size={18} />
            เลือกแล้ว <strong>{selected.length}</strong> รายการ
          </span>
          <button className="text-link" onClick={() => setSelected([])}>
            ยกเลิกเลือก
          </button>
          <div>
            <button
              className="button danger-outline"
              onClick={() => {
                mutation.reset();
                setDecision("REJECT");
              }}
            >
              <X size={17} />
              ส่งคืน
            </button>
            <button
              className="button approve-button"
              onClick={() => {
                mutation.reset();
                setDecision("APPROVE");
              }}
            >
              <Check size={17} />
              อนุมัติ
            </button>
          </div>
        </div>
      )}
      {decision && (
        <Modal
          title={
            decision === "APPROVE"
              ? "ยืนยันการอนุมัติ"
              : "ส่งคืนกิจกรรมเพื่อแก้ไข"
          }
          onClose={() => {
            if (!mutation.isPending) setDecision(null);
          }}
        >
          <form
            className="modal-body"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="review-confirm-icon">
              <Send size={26} />
            </div>
            <p>
              คุณกำลัง{decision === "APPROVE" ? "อนุมัติ" : "ส่งคืน"}
              กิจกรรมที่เลือก <strong>{selected.length} รายการ</strong>
            </p>
            <p className="muted small">
              ระบบจะดำเนินการพร้อมกันทั้งชุด
              หากข้อมูลเปลี่ยนแปลงจะให้โหลดรายการใหม่
            </p>
            {decision === "REJECT" && (
              <label>
                เหตุผลที่ส่งคืน
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  maxLength={1000}
                  placeholder="ระบุสิ่งที่นักเรียนควรแก้ไข…"
                  rows={4}
                />
              </label>
            )}
            {mutation.error && <ErrorBox error={mutation.error} />}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                disabled={mutation.isPending}
                onClick={() => setDecision(null)}
              >
                ยกเลิก
              </button>
              <button
                className={
                  "button " + (decision === "APPROVE" ? "primary" : "danger")
                }
                disabled={mutation.isPending}
              >
                {mutation.isPending
                  ? "กำลังดำเนินการ…"
                  : "ยืนยัน" +
                    (decision === "APPROVE" ? "การอนุมัติ" : "ส่งคืน")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
