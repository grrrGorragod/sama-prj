import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  Activity,
  AttachmentInfo,
  AttachmentUploadResult,
} from "../lib/types";

export interface PendingEvidence {
  clientId: string;
  file: File;
  preview?: string;
}
export const MAX_EVIDENCE_FILES = 5;
export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
export function evidenceUrl(activityId: string, fileId: string) {
  return `/api/activities/${activityId}/attachments/${fileId}`;
}
export function fileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function useActivityEvidence(activityId?: string) {
  const client = useQueryClient();
  const [pending, setPending] = useState<PendingEvidence[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [selectionError, setSelectionError] = useState("");
  const previews = useRef(new Map<string, string>());
  const query = useQuery({
    queryKey: ["attachments", activityId],
    queryFn: () =>
      api<AttachmentInfo[]>(`/activities/${activityId}/attachments`),
    enabled: !!activityId,
  });
  useEffect(
    () => () => {
      previews.current.forEach((url) => URL.revokeObjectURL(url));
      previews.current.clear();
    },
    [],
  );
  function release(clientId: string) {
    const url = previews.current.get(clientId);
    if (url) URL.revokeObjectURL(url);
    previews.current.delete(clientId);
  }
  function addFiles(files: File[]) {
    setSelectionError("");
    const current =
      (query.data || []).filter((f) => !removed.includes(f.id)).length +
      pending.length;
    if (current + files.length > MAX_EVIDENCE_FILES) {
      setSelectionError("แนบหลักฐานได้สูงสุด 5 ไฟล์ต่อกิจกรรม");
      return;
    }
    for (const file of files) {
      if (!/\.(jpe?g|png|webp|pdf)$/i.test(file.name)) {
        setSelectionError("รองรับเฉพาะรูป JPG, PNG, WEBP และไฟล์ PDF");
        return;
      }
      if (!file.size) {
        setSelectionError("ไฟล์หลักฐานต้องไม่เป็นไฟล์ว่าง");
        return;
      }
      if (file.size > MAX_EVIDENCE_BYTES) {
        setSelectionError(`ไฟล์ ${file.name} มีขนาดเกิน 5 MB`);
        return;
      }
    }
    const additions = files.map((file) => {
      const clientId = crypto.randomUUID();
      const preview = /\.(jpe?g|png|webp)$/i.test(file.name)
        ? URL.createObjectURL(file)
        : undefined;
      if (preview) previews.current.set(clientId, preview);
      return { clientId, file, preview };
    });
    setPending((old) => [...old, ...additions]);
  }
  function resetSelection() {
    previews.current.forEach((url) => URL.revokeObjectURL(url));
    previews.current.clear();
    setPending([]);
    setRemoved([]);
    setSelectionError("");
  }
  function removePending(clientId: string) {
    release(clientId);
    setPending((old) => old.filter((f) => f.clientId !== clientId));
    setSelectionError("");
  }
  function removeSaved(id: string) {
    setRemoved((old) => (old.includes(id) ? old : [...old, id]));
    setSelectionError("");
  }
  function undoRemoval(id: string) {
    setRemoved((old) => old.filter((f) => f !== id));
  }
  async function commit(
    activity: Activity,
    remember: (activity: Activity) => void,
  ) {
    let current = activity;
    const key = ["attachments", activity.id];
    await client.cancelQueries({ queryKey: key });
    for (const id of removed) {
      const result = await api<{ activityVersion: number }>(
        `/activities/${activity.id}/attachments/${id}`,
        {
          method: "DELETE",
          body: JSON.stringify({ expectedVersion: current.version }),
        },
      );
      current = { ...current, version: result.activityVersion };
      remember(current);
      client.setQueryData<AttachmentInfo[]>(key, (old) =>
        (old || []).filter((f) => f.id !== id),
      );
      setRemoved((old) => old.filter((f) => f !== id));
    }
    for (const file of pending) {
      const data = new FormData();
      data.append("file", file.file);
      data.append("expectedVersion", String(current.version));
      data.append("clientUploadId", file.clientId);
      const result = await api<AttachmentUploadResult>(
        `/activities/${activity.id}/attachments`,
        { method: "POST", body: data },
      );
      current = { ...current, version: result.activityVersion };
      remember(current);
      client.setQueryData<AttachmentInfo[]>(key, (old) => [
        ...(old || []).filter((f) => f.id !== result.attachment.id),
        result.attachment,
      ]);
      setPending((old) => old.filter((f) => f.clientId !== file.clientId));
      release(file.clientId);
    }
    return current;
  }
  return {
    query,
    pending,
    removed,
    selectionError,
    addFiles,
    removePending,
    removeSaved,
    undoRemoval,
    commit,
    resetSelection,
  };
}
