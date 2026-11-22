export type Role = "student" | "teacher";
export type Account = { id: string; name: string; role: Role };
export type Phase = "before" | "after";
export type Material = { title: string; kind: "text" | "link" | "example" | "definition"; phase: Phase; value: string };
export type WorkKind = "practice" | "homework" | "assessment";
export type AnswerFormat = "text" | "number";
export type Task = {
  title: string; prompt: string; topic: string; max: number; phase?: Phase; kind?: WorkKind;
  hint?: string; solution?: string; rubric?: string; modelAnswer?: string;
  response?: "file" | "text" | "short" | "single" | "multiple";
  options?: string[]; correct?: number[];
  answerKey?: { format: AnswerFormat; values: string[] };
};
export type WorkSettings = { title?: string; instructions?: string; minutes?: number; pass?: number; dueDays?: number };
export type Lesson = { title: string; topic: string; theory: string; tasks: Task[]; materials?: Material[]; work?: Partial<Record<WorkKind, WorkSettings>> };
export type Assignment = {
  id: string; teacher_id: string; student_id: string;
  entry_kind: "lesson" | "homework"; lesson_id: string | null; due_at: Date | null;
  cancelled_at: Date | null;
  content: Lesson; starts: Date; settings: Partial<LessonSettings>; revision: number;
};
export type LessonSettings = { format: "online" | "offline" | "self"; duration: number; location: string };
export const formats = { online: "Онлайн", offline: "Очно", self: "Самостоятельно" };
export type Attachment = { id: string; name: string; task: number };
export type Grade = { score: number; comment: string };
export type Submission = { assignment: string; student: string; files: Attachment[]; answers?: Record<string, string | number[]>; grades: (Grade | null)[] | null };
export const roles = { student: "Ученик", teacher: "Преподаватель" };
