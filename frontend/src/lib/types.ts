export type Role = "STUDENT" | "TEACHER";
export type Status = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
export interface Me {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  studentCode: string | null;
  department: string | null;
  phone: string;
  address: string;
  emailEditable: boolean;
}
export interface Term {
  id: string;
  label: string;
  startsOn: string;
  endsOn: string;
  submissionDeadline: string;
}
export interface Category {
  id: string;
  code: string;
  name: string;
  description: string;
  color: string;
  metric: "COUNT" | "DURATION_MINUTES" | null;
  target: number | null;
}
export interface CategoryProgress {
  categoryId: string;
  code: string;
  name: string;
  description: string;
  color: string;
  metric: "COUNT" | "DURATION_MINUTES";
  target: number;
  approvedValue: number;
  remaining: number;
  percent: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  draftCount: number;
}
export interface Summary {
  studentId: string;
  studentName: string;
  studentCode: string;
  classroom: string;
  rollNumber: number;
  termId: string;
  termLabel: string;
  configured: boolean;
  completed: boolean;
  percent: number;
  totalActivities: number;
  approved: number;
  pending: number;
  rejected: number;
  draft: number;
  totalApprovedMinutes: number;
  categories: CategoryProgress[];
}
export interface ClassroomSummary {
  classroomId: string;
  classroom: string;
  termId: string;
  totalStudents: number;
  completedStudents: number;
  incompleteStudents: number;
  students: Summary[];
}
export interface Room {
  id: string;
  label: string;
}
export interface Activity {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  color: string;
  termId: string;
  termLabel: string;
  activityDate: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  status: Status;
  version: number;
  createdAt: string;
  submittedAt: string | null;
  studentId: string;
  studentName: string;
  reviewerId: string | null;
  reviewerName: string | null;
}
export interface History {
  sequence: number;
  fromStatus: Status | null;
  toStatus: Status;
  actorId: string;
  actorName: string;
  occurredAt: string;
  reason: string | null;
}
export interface Detail {
  activity: Activity;
  history: History[];
}
export interface AttachmentInfo {
  id: string;
  clientUploadId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}
export interface AttachmentUploadResult {
  attachment: AttachmentInfo;
  activityVersion: number;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}
export interface Teacher {
  id: string;
  fullName: string;
  department: string;
  favorite: boolean;
}
