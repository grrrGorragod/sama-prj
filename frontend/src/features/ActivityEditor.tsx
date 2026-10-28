import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, Save, Send } from "lucide-react";
import type {
  Activity,
  AttachmentInfo,
  Category,
  Detail,
  Me,
  Page,
  Teacher,
  Term,
} from "../lib/types";
import { api, ApiError } from "../lib/api";
import { Modal, ErrorBox, CategoryIcon } from "../components/ui";
import { EvidenceField } from "../components/EvidenceFiles";
import { useActivityEvidence } from "./useActivityEvidence";

export default function ActivityEditor({
  me,
  term,
  categories,
  initial,
  onClose,
  onSuccess,
}: {
  me: Me;
  term: Term;
  categories: Category[];
  initial: { categoryId?: string; activity?: Activity };
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const a = initial.activity;
  const directCategory = !!initial.categoryId && !a;
  const [saved, setSaved] = useState<Activity | undefined>(a);
  const savedRef = useRef(saved);
  const client = useQueryClient();
  const [categoryId, setCategoryId] = useState(
    a?.categoryId || initial.categoryId || categories[0]?.id || "",
  );
  const category = categories.find((c) => c.id === categoryId);
  const [title, setTitle] = useState(
    a?.title || (directCategory ? category?.name || "" : ""),
  );
  const [titleTouched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState(a?.description || "");
  const [activityDate, setDate] = useState(
    a?.activityDate ||
      new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok" }).format(
        new Date(),
      ),
  );
  const [startTime, setStart] = useState(a?.startTime?.slice(0, 5) || "");
  const [endTime, setEnd] = useState(a?.endTime?.slice(0, 5) || "");
  const [reviewerId, setReviewer] = useState(a?.reviewerId || "");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState<unknown>();
  useEffect(() => {
    if (!categoryId && categories[0]) setCategoryId(categories[0].id);
    if (directCategory && !titleTouched && category?.name)
      setTitle(category.name);
  }, [categoryId, categories, directCategory, titleTouched, category?.name]);
  const teachers = useQuery({
    queryKey: ["teachers", teacherSearch],
    queryFn: () =>
      api<Page<Teacher>>(
        "/teachers?search=" + encodeURIComponent(teacherSearch),
      ),
  });
  const favorites = useQuery({
    queryKey: ["favorites"],
    queryFn: () => api<Teacher[]>("/me/favorite-teachers"),
  });
  const evidence = useActivityEvidence(saved?.id);
  function remember(activity: Activity) {
    savedRef.current = activity;
    setSaved(activity);
  }
  async function reloadLatest() {
    const current = savedRef.current;
    if (!current) return;
    setReloading(true);
    setReloadError(undefined);
    try {
      const latest = (await api<Detail>("/activities/" + current.id)).activity;
      const attachments = await api<AttachmentInfo[]>(
        `/activities/${current.id}/attachments`,
      );
      if (latest.status !== "DRAFT" && latest.status !== "REJECTED") {
        throw new Error(
          "กิจกรรมนี้ถูกส่งตรวจแล้ว กรุณาปิดหน้าต่างและเปิดดูรายการล่าสุด",
        );
      }
      setTitle(latest.title || "");
      setTitleTouched(true);
      setDescription(latest.description || "");
      setDate(latest.activityDate || "");
      setStart(latest.startTime?.slice(0, 5) || "");
      setEnd(latest.endTime?.slice(0, 5) || "");
      setCategoryId(latest.categoryId);
      setReviewer(latest.reviewerId || "");
      evidence.resetSelection();
      client.setQueryData(["attachments", current.id], attachments);
      remember(latest);
      mutation.reset();
      setConflict(false);
    } catch (error) {
      setReloadError(error);
    } finally {
      setReloading(false);
    }
  }
  const mutation = useMutation({
    mutationFn: async (submit: boolean) => {
      if (conflict) throw new Error("กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก");
      if (!categoryId) throw new Error("กรุณาเลือกหมวดกิจกรรม");
      if (startTime && endTime && startTime >= endTime)
        throw new Error("เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น");
      if (
        submit &&
        (!title.trim() ||
          !description.trim() ||
          !activityDate ||
          !startTime ||
          !endTime ||
          !reviewerId)
      )
        throw new Error(
          "กรุณากรอกชื่อ รายละเอียด วันที่ เวลา และเลือกครูผู้ตรวจให้ครบ",
        );
      let persisted = false;
      try {
        const previous = savedRef.current;
        let result = await api<Activity>(
          previous ? "/activities/" + previous.id : "/activities",
          {
            method: previous ? "PATCH" : "POST",
            body: JSON.stringify({
              termId: previous?.termId || term.id,
              categoryId,
              reviewerId: reviewerId || null,
              title,
              description,
              activityDate: activityDate || null,
              startTime: startTime || null,
              endTime: endTime || null,
              expectedVersion: previous?.version,
            }),
          },
        );
        persisted = true;
        remember(result);
        result = await evidence.commit(result, remember);
        if (submit) {
          result = await api<Activity>("/activities/" + result.id + "/submit", {
            method: "POST",
            body: JSON.stringify({
              reviewerId,
              expectedVersion: result.version,
            }),
          });
          remember(result);
        }
        return submit;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) throw error;
        if (error instanceof ApiError && error.status === 409) {
          setConflict(true);
          throw error;
        }
        const current = savedRef.current;
        if (current) {
          try {
            const latest = await api<Detail>("/activities/" + current.id);
            // Recover an uncertain attachment response only when the form data is unchanged.
            const keys = [
              "title",
              "description",
              "categoryId",
              "termId",
              "activityDate",
              "startTime",
              "endTime",
              "status",
              "reviewerId",
            ] as const;
            if (keys.every((key) => latest.activity[key] === current[key])) {
              remember(latest.activity);
            } else {
              setConflict(true);
            }
            await client.invalidateQueries({
              queryKey: ["attachments", current.id],
            });
          } catch {
            /* Keep queued files and the last known version available for retry. */
          }
        }
        if (persisted)
          throw new Error(
            "บันทึกข้อมูลกิจกรรมไว้แล้ว แต่หลักฐานหรือการส่งตรวจยังไม่สำเร็จ: " +
              (error instanceof Error ? error.message : "กรุณาลองใหม่"),
          );
        throw error;
      }
    },
    onSuccess: (submitted) =>
      onSuccess(
        submitted
          ? "ส่งกิจกรรมให้ครูเรียบร้อยแล้ว"
          : "บันทึกแบบร่างและหลักฐานเรียบร้อยแล้ว",
      ),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const button = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement;
    mutation.mutate(button?.value === "submit");
  }
  const favoriteIds = new Set(favorites.data?.map((t) => t.id));
  const options = [
    ...(favorites.data || []),
    ...(teachers.data?.items || []).filter((t) => !favoriteIds.has(t.id)),
  ];
  return (
    <Modal
      variant="page"
      title={a ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม"}
      onClose={() => {
        if (!mutation.isPending && !reloading) onClose();
      }}
    >
      <form
        className={
          "modal-body activity-form" +
          (directCategory ? " compact-activity-form" : "")
        }
        onSubmit={submit}
      >
        <fieldset disabled={mutation.isPending || reloading}>
          {conflict && (
            <div className="conflict-notice" role="alert">
              <p>
                ข้อมูลถูกเปลี่ยนจากอีกหน้าต่างแล้ว
                ระบบหยุดการบันทึกเพื่อป้องกันการเขียนทับ
              </p>
              <p>
                การโหลดข้อมูลล่าสุดจะแทนที่ข้อมูลในฟอร์มและยกเลิกไฟล์ที่ยังไม่ได้บันทึก
                กรุณาคัดลอกสิ่งที่ต้องการเก็บไว้ก่อน
              </p>
              <button
                type="button"
                className="button secondary"
                onClick={() => void reloadLatest()}
              >
                {reloading ? "กำลังโหลด…" : "โหลดข้อมูลล่าสุด"}
              </button>
              {!!reloadError && <ErrorBox error={reloadError} />}
            </div>
          )}
          <div
            className={
              "editor-category-banner " +
              (category?.color || a?.color || "purple")
            }
          >
            <CategoryIcon
              code={category?.code || a?.categoryCode || ""}
              size={28}
            />
            <div>
              <span>ประสบการณ์ใหม่ของ {me.fullName.split(" ")[0]}</span>
              <strong>
                {category?.name || a?.categoryName || "เลือกหมวดกิจกรรม"}
              </strong>
            </div>
          </div>
          {!directCategory && (
            <div className="form-row">
              <label>
                หมวดกิจกรรม
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={!!saved}
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="term-field">
                ปี / ภาคเรียน
                <input value={a?.termLabel || term.label} readOnly />
              </label>
            </div>
          )}
          <label>
            ชื่อกิจกรรม <span className="required">*</span>
            <input
              aria-label="ชื่อกิจกรรม"
              value={title}
              onChange={(e) => {
                setTitleTouched(true);
                setTitle(e.target.value);
              }}
              maxLength={200}
              placeholder="เช่น วิ่งออกกำลังกายกับเพื่อน"
            />
          </label>
          <label>
            วันที่ทำกิจกรรม <span className="required">*</span>
            <input
              type="date"
              min={term.startsOn}
              max={term.endsOn}
              value={activityDate}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <div className="form-row">
            <label>
              เวลาเริ่มต้น <span className="required">*</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              เวลาสิ้นสุด <span className="required">*</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
          <label>
            รายละเอียด / ลักษณะกิจกรรม <span className="required">*</span>
            <textarea
              rows={directCategory ? 2 : 4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={4000}
              placeholder="เล่าว่าคุณได้ทำอะไร มีหน้าที่อย่างไร และได้เรียนรู้อะไรบ้าง…"
            />
          </label>
          <EvidenceField
            activityId={saved?.id}
            files={evidence.query.data || []}
            pending={evidence.pending}
            removed={evidence.removed}
            onSelect={evidence.addFiles}
            onRemovePending={evidence.removePending}
            onRemoveSaved={evidence.removeSaved}
            onUndoRemoval={evidence.undoRemoval}
            error={evidence.selectionError}
            loading={!!saved?.id && evidence.query.isPending}
            loadError={evidence.query.error}
            retry={() => void evidence.query.refetch()}
            disabled={mutation.isPending}
          />
          {!directCategory && <div className="form-divider" />}
          <label>
            ค้นหาครูผู้ตรวจ
            <input
              value={teacherSearch}
              onChange={(e) => setTeacherSearch(e.target.value)}
              placeholder="ค้นหาชื่อครู…"
            />
          </label>
          <label>
            ส่งกิจกรรมให้ครู <span className="required">*</span>
            <select
              value={reviewerId}
              onChange={(e) => setReviewer(e.target.value)}
            >
              <option value="">เลือกครูผู้ตรวจ</option>
              {reviewerId && !options.some((t) => t.id === reviewerId) && (
                <option value={reviewerId}>
                  {a?.reviewerName || "ครูที่เลือกไว้"}
                </option>
              )}
              {options.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.favorite ? "★ " : ""}
                  {t.fullName} · {t.department}
                </option>
              ))}
            </select>
          </label>
          {teachers.error && (
            <ErrorBox
              error={teachers.error}
              retry={() => void teachers.refetch()}
            />
          )}
          <div className="form-note">
            <Info size={16} />
            <span>
              บันทึกแบบร่างได้แม้ข้อมูลยังไม่ครบ
              และกลับมาแก้ไขก่อนส่งตรวจได้
            </span>
          </div>
          {mutation.error && <ErrorBox error={mutation.error} />}
          <div className="modal-actions">
            <button
              value="draft"
              className="button secondary"
              disabled={conflict}
            >
              <Save size={17} />
              {mutation.isPending ? "กำลังบันทึก…" : "บันทึกแบบร่าง"}
            </button>
            <button
              value="submit"
              className="button primary"
              disabled={conflict}
            >
              <Send size={17} />
              {mutation.isPending
                ? "กำลังบันทึก…"
                : directCategory
                  ? "ส่งกิจกรรมให้ครู"
                  : "ส่งให้ครูตรวจ"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
