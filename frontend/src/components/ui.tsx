import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  Activity,
  BookOpen,
  HeartHandshake,
  MessageCircle,
  FlaskConical,
  Users,
  Flower2,
  X,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import { statusNames } from "../lib/api";
import type { Status } from "../lib/types";
export function CategoryIcon({
  code,
  size = 22,
}: {
  code: string;
  size?: number;
}) {
  const Icon = code.includes("ADVISOR")
    ? MessageCircle
    : code.includes("READING")
      ? BookOpen
      : code.includes("CAMP")
        ? FlaskConical
        : code.includes("EXERCISE")
          ? Activity
          : code.includes("CLUB")
            ? Users
            : code.includes("COMMUNITY")
              ? Flower2
              : HeartHandshake;
  return <Icon size={size} strokeWidth={1.8} />;
}
export function Badge({ status }: { status: Status }) {
  return (
    <span className={"badge " + status.toLowerCase()}>
      <i />
      {statusNames[status]}
    </span>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={24} /> กำลังโหลดข้อมูล…
    </div>
  );
}
export function ErrorBox({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={20} />
      <span>{error instanceof Error ? error.message : "เกิดข้อผิดพลาด"}</span>
      {retry && <button onClick={retry}>ลองใหม่</button>}
    </div>
  );
}
export function Empty({
  title = "ยังไม่มีรายการ",
  text = "เริ่มบันทึกกิจกรรมแรกของคุณได้เลย",
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <BookOpen size={30} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
let openModals = 0;
let originalOverflow = "";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  variant,
  className = "",
  dismissible = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  variant?: "page";
  className?: string;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    if (openModals++ === 0) originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (--openModals === 0) document.body.style.overflow = originalOverflow;
      if (el.open) el.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={
        "modal " +
        (wide ? "wide " : "") +
        (variant === "page" ? "page-modal " : "") +
        className
      }
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
      aria-labelledby={titleId}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        {dismissible && (
          <button
            className="icon-button"
            aria-label="ปิดหน้าต่าง"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        )}
      </div>
      {children}
    </dialog>
  );
}
