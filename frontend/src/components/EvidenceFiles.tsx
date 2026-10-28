import { useRef } from "react";
import {
  Download,
  FileText,
  ImagePlus,
  Paperclip,
  RotateCcw,
  X,
} from "lucide-react";
import type { AttachmentInfo } from "../lib/types";
import type { PendingEvidence } from "../features/useActivityEvidence";
import { evidenceUrl, fileSize } from "../features/useActivityEvidence";
import { ErrorBox } from "./ui";

export function EvidenceList({
  activityId,
  files,
  onRemove,
}: {
  activityId: string;
  files: AttachmentInfo[];
  onRemove?: (id: string) => void;
}) {
  return (
    <div className="evidence-list">
      {files.map((file) => (
        <div className="evidence-file" key={file.id}>
          {file.contentType.startsWith("image/") ? (
            <img
              src={evidenceUrl(activityId, file.id)}
              alt={"หลักฐาน " + file.originalName}
              className="evidence-thumbnail"
              loading="lazy"
            />
          ) : (
            <span className="evidence-document">
              <FileText size={25} />
            </span>
          )}
          <div className="evidence-file-info">
            <strong title={file.originalName}>{file.originalName}</strong>
            <small>{fileSize(file.sizeBytes)} · บันทึกแล้ว</small>
          </div>
          <a
            className="icon-button"
            href={evidenceUrl(activityId, file.id)}
            download={file.originalName}
            aria-label={"ดาวน์โหลดหลักฐาน " + file.originalName}
          >
            <Download size={19} />
          </a>
          {onRemove && (
            <button
              type="button"
              className="icon-button evidence-remove"
              aria-label={"นำหลักฐาน " + file.originalName + " ออก"}
              onClick={() => onRemove(file.id)}
            >
              <X size={19} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
export function EvidenceField({
  activityId,
  files,
  pending,
  removed,
  onSelect,
  onRemovePending,
  onRemoveSaved,
  onUndoRemoval,
  error,
  loading,
  loadError,
  retry,
  disabled,
}: {
  activityId?: string;
  files: AttachmentInfo[];
  pending: PendingEvidence[];
  removed: string[];
  onSelect: (files: File[]) => void;
  onRemovePending: (id: string) => void;
  onRemoveSaved: (id: string) => void;
  onUndoRemoval: (id: string) => void;
  error: string;
  loading: boolean;
  loadError: unknown;
  retry: () => void;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const existing = files.filter((f) => !removed.includes(f.id));
  const count = existing.length + pending.length;
  return (
    <section className="evidence-section" aria-label="หลักฐานกิจกรรม">
      <div className="evidence-heading">
        <h3>
          <Paperclip size={18} />
          หลักฐานกิจกรรม <span>(ไม่บังคับ)</span>
        </h3>
        <span>{count}/5 ไฟล์</span>
      </div>
      <p className="evidence-help">
        รูป JPG, PNG, WEBP หรือ PDF · ไม่เกิน 5 MB ต่อไฟล์
      </p>
      <input
        ref={input}
        className="visually-hidden"
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.pdf"
        aria-label="แนบหลักฐาน"
        disabled={disabled || count >= 5 || loading || !!loadError}
        onChange={(e) => {
          if (e.target.files) onSelect(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className="evidence-upload"
        disabled={disabled || count >= 5 || loading || !!loadError}
        onClick={() => input.current?.click()}
      >
        <ImagePlus size={26} />
        <strong>เลือกรูปภาพหรือไฟล์หลักฐาน</strong>
        <span>ไฟล์จะถูกบันทึกเมื่อกดบันทึกแบบร่างหรือส่งกิจกรรม</span>
      </button>
      {loading && <p className="evidence-help">กำลังโหลดหลักฐานเดิม…</p>}
      {!!loadError && <ErrorBox error={loadError} retry={retry} />}{" "}
      {activityId && (
        <EvidenceList
          activityId={activityId}
          files={existing}
          onRemove={onRemoveSaved}
        />
      )}
      <div className="evidence-list">
        {pending.map((file) => (
          <div className="evidence-file pending-file" key={file.clientId}>
            {file.preview ? (
              <img
                src={file.preview}
                alt={"ตัวอย่าง " + file.file.name}
                className="evidence-thumbnail"
              />
            ) : (
              <span className="evidence-document">
                <FileText size={25} />
              </span>
            )}
            <div className="evidence-file-info">
              <strong title={file.file.name}>{file.file.name}</strong>
              <small>{fileSize(file.file.size)} · รอบันทึก</small>
            </div>
            <button
              type="button"
              className="icon-button evidence-remove"
              disabled={disabled}
              aria-label={"นำไฟล์ที่เลือก " + file.file.name + " ออก"}
              onClick={() => onRemovePending(file.clientId)}
            >
              <X size={19} />
            </button>
          </div>
        ))}
      </div>
      {removed.length > 0 && (
        <div className="evidence-removals">
          {files
            .filter((f) => removed.includes(f.id))
            .map((file) => (
              <div key={file.id}>
                <span>{file.originalName} · จะนำออกเมื่อบันทึก</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onUndoRemoval(file.id)}
                  aria-label={
                    "ยกเลิกการนำหลักฐาน " + file.originalName + " ออก"
                  }
                >
                  <RotateCcw size={15} />
                  ยกเลิก
                </button>
              </div>
            ))}
        </div>
      )}
      {error && <ErrorBox error={new Error(error)} />}
    </section>
  );
}
