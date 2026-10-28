import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Check,
  Undo2,
  CalendarDays,
  Clock3,
  UserRound,
  Pencil,
  ArrowRight,
  Paperclip,
} from "lucide-react";
import type { Me, Activity, Detail, AttachmentInfo } from "../lib/types";
import { api, date, statusNames } from "../lib/api";
import {
  Modal,
  Loading,
  ErrorBox,
  Badge,
  CategoryIcon,
} from "../components/ui";
import { EvidenceList } from "../components/EvidenceFiles";
export { default as ActivityEditor } from "./ActivityEditor";
export function ActivityDetail({
  id,
  me,
  onClose,
  onEdit,
  notify,
}: {
  id: string;
  me: Me;
  onClose: () => void;
  onEdit: (activity: Activity) => void;
  notify: (message: string) => void;
}) {
  const detail = useQuery({
    queryKey: ["detail", id],
    queryFn: () => api<Detail>("/activities/" + id),
  });
  const attachments = useQuery({
    queryKey: ["attachments", id],
    queryFn: () => api<AttachmentInfo[]>("/activities/" + id + "/attachments"),
    enabled: !!detail.data,
  });
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | null>(null);
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      api("/reviews/bulk", {
        method: "POST",
        body: JSON.stringify({
          items: [
            { activityId: id, expectedVersion: detail.data?.activity.version },
          ],
          decision,
          reason,
        }),
      }),
    onSuccess: () => {
      notify(
        decision === "APPROVE" ? "อนุมัติกิจกรรมแล้ว" : "ส่งคืนกิจกรรมแล้ว",
      );
      onClose();
    },
    onError: () => {
      void detail.refetch();
    },
  });
  const a = detail.data?.activity;
  return (
    <Modal
      variant="page"
      title="ดูกิจกรรม"
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      {detail.isPending ? (
        <Loading />
      ) : detail.error ? (
        <div className="modal-body">
          <ErrorBox error={detail.error} retry={() => void detail.refetch()} />
        </div>
      ) : (
        a && (
          <div className="modal-body">
            <div className="detail-heading">
              <span className={"category-icon " + a.color}>
                <CategoryIcon code={a.categoryCode} size={28} />
              </span>
              <div>
                <small>{a.categoryName}</small>
                <h3>{a.title || "ยังไม่ระบุชื่อกิจกรรม"}</h3>
              </div>
              <Badge status={a.status} />
            </div>
            <div className="detail-grid">
              <div>
                <CalendarDays size={17} />
                <span>
                  วันที่ทำกิจกรรม<strong>{date(a.activityDate)}</strong>
                </span>
              </div>
              <div>
                <Clock3 size={17} />
                <span>
                  เวลา
                  <strong>
                    {a.startTime?.slice(0, 5) || "—"} –{" "}
                    {a.endTime?.slice(0, 5) || "—"}{" "}
                    {a.durationMinutes ? `(${a.durationMinutes} นาที)` : ""}
                  </strong>
                </span>
              </div>
              <div>
                <UserRound size={17} />
                <span>
                  นักเรียน<strong>{a.studentName}</strong>
                </span>
              </div>
              <div>
                <UserRound size={17} />
                <span>
                  ครูผู้ตรวจ<strong>{a.reviewerName || "ยังไม่ได้ส่ง"}</strong>
                </span>
              </div>
            </div>
            <div className="detail-description">
              <h4>รายละเอียดกิจกรรม</h4>
              <p>{a.description || "ยังไม่มีรายละเอียด"}</p>
            </div>
            <section className="detail-evidence">
              <h4>
                <Paperclip size={17} />
                หลักฐานกิจกรรม
              </h4>
              {attachments.isPending ? (
                <p className="evidence-help">กำลังโหลดหลักฐาน…</p>
              ) : attachments.error ? (
                <ErrorBox
                  error={attachments.error}
                  retry={() => void attachments.refetch()}
                />
              ) : attachments.data?.length ? (
                <EvidenceList activityId={id} files={attachments.data} />
              ) : (
                <p className="evidence-help">ยังไม่มีหลักฐานแนบ</p>
              )}
            </section>
            <div className="timeline-section">
              <h4>ประวัติสถานะกิจกรรม</h4>
              <ol className="timeline">
                {detail.data?.history.map((h) => (
                  <li key={h.sequence} className={h.toStatus.toLowerCase()}>
                    <span className="timeline-dot" />
                    <div>
                      <strong>
                        {h.toStatus === "DRAFT"
                          ? "สร้างแล้ว"
                          : statusNames[h.toStatus]}
                      </strong>
                      <small>
                        {date(h.occurredAt, true)} ·{" "}
                        {h.actorName || "ผู้ใช้เดิม"}
                      </small>
                      {h.reason && <p className="return-reason">{h.reason}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            {me.role === "STUDENT" &&
              (a.status === "DRAFT" || a.status === "REJECTED") && (
                <button
                  className="button primary full-width"
                  onClick={() => onEdit(a)}
                >
                  <Pencil size={17} />
                  แก้ไข / ส่งกิจกรรม
                  <ArrowRight size={17} />
                </button>
              )}
            {me.role === "TEACHER" && a.status === "PENDING" && (
              <div className="detail-review">
                {decision === "REJECT" && (
                  <label>
                    เหตุผลที่ส่งคืน
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={1000}
                      rows={3}
                      placeholder="ระบุสิ่งที่ควรแก้ไข…"
                    />
                  </label>
                )}
                {mutation.error && <ErrorBox error={mutation.error} />}
                <div className="modal-actions">
                  <button
                    className="button danger-outline"
                    disabled={mutation.isPending}
                    onClick={() => {
                      if (decision === "REJECT") {
                        mutation.mutate();
                      } else setDecision("REJECT");
                    }}
                  >
                    <Undo2 size={17} />
                    {decision === "REJECT" ? "ยืนยันส่งคืน" : "ส่งคืน"}
                  </button>
                  <button
                    className="button primary"
                    disabled={mutation.isPending}
                    onClick={() => {
                      if (decision === "APPROVE") mutation.mutate();
                      else setDecision("APPROVE");
                    }}
                  >
                    <Check size={17} />
                    {mutation.isPending
                      ? "กำลังบันทึก…"
                      : decision === "APPROVE"
                        ? "ยืนยันอนุมัติ"
                        : "อนุมัติกิจกรรม"}
                  </button>
                </div>
                {decision === "APPROVE" && (
                  <p className="muted small">
                    กด “ยืนยันอนุมัติ” เพื่อรับรองกิจกรรมนี้
                  </p>
                )}
              </div>
            )}
          </div>
        )
      )}
    </Modal>
  );
}
