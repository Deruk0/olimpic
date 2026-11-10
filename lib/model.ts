import type { AssignmentSources } from "./library";
export type Role = "student" | "curator" | "methodist";
export type Level = "basic" | "advanced";
export type ProgramKey = Level | "diagnostic";
export type Account = { id: string; name: string; role: Role; goal: string };
export type Group = { id: string; name: string; curator: string };
export type Phase = "before" | "after";
export type Material = { title: string; kind: "text" | "link" | "example" | "definition"; phase: Phase; value: string };
export type WorkKind = "practice" | "homework" | "assessment" | "diagnostic";
export type Task = { title: string; prompt: string; topic: string; max: number; phase?: Phase; kind?: WorkKind; hint?: string; solution?: string; rubric?: string; response?: "file" | "text" | "single" | "multiple"; options?: string[]; correct?: number[]; modelAnswer?: string };
export type WorkSettings = { title?: string; instructions?: string; minutes?: number; pass?: number; dueDays?: number };
export type Lesson = { title: string; topic: string; theory: string; tasks: Task[]; materials?: Material[]; work?: Partial<Record<WorkKind, WorkSettings>> };
export type Program = { lessons: Lesson[]; advanced: number; priority: number; olympiad: string };
export type ProgramRow = { level: ProgramKey; draft: Program; published: Program | null };
export type Assignment = { id: string; group_id: string; kind: "lesson" | "diagnostic"; level: ProgramKey; content: Lesson; starts: Date | null; meeting: string; group_name?: string; settings: Partial<LessonSettings>; sources?: AssignmentSources | null; revision: number; deleted_at?: Date | null };
export type LessonSettings = { format: "online" | "offline" | "self"; duration: number; location: string; recording: string };
export const formats = { online: "Онлайн", offline: "Очно", self: "Самостоятельно" };
export type Attachment = { id: string; name: string; task: number };
export type Grade = { score: number; comment: string };
export type Submission = { assignment: string; student: string; files: Attachment[]; answers?: Record<string, string | number[]>; grades: (Grade | null)[] | null };
export type Topic = { name: string; due: string };
export type Trajectory = { student: string; level: Level; topics: Topic[] };
export const levels = { basic: "Базовый", advanced: "Продвинутый", diagnostic: "Диагностика" };
export const roles = { student: "Ученик", curator: "Куратор", methodist: "Методист" };
export const emptyProgram: Program = { lessons: [], advanced: 70, priority: 60, olympiad: "ВсОШ по математике" };
export function recommendation(tasks: Task[], grades: (Grade | null)[], programs: ProgramRow[]) {
  if (!tasks.length || tasks.length !== grades.length || grades.some(grade => !grade)) return null;
  const rubric = programs.find(p => p.level === "diagnostic")?.published ?? emptyProgram;
  const total = tasks.reduce((sum, task) => sum + task.max, 0);
  const percent = 100 * grades.reduce((sum, grade) => sum + (grade?.score ?? 0), 0) / total;
  const level: Level = percent >= rubric.advanced ? "advanced" : "basic";
  const byTopic = new Map<string, { score: number; max: number }>();
  tasks.forEach((task, index) => {
    const value = byTopic.get(task.topic) ?? { score: 0, max: 0 };
    byTopic.set(task.topic, { score: value.score + (grades[index]?.score ?? 0), max: value.max + task.max });
  });
  const results = [...byTopic].map(([name, value]) => ({ name, percent: 100 * value.score / value.max }));
  const priority = results.filter(topic => topic.percent < rubric.priority).map(topic => topic.name);
  const curriculum = programs.find(p => p.level === level)?.published?.lessons.map(lesson => lesson.topic) ?? [];
  return { level, percent, results, threshold: rubric.advanced, priorityThreshold: rubric.priority,
    topics: [...new Set([...priority, ...curriculum])].map(name => ({ name, due: "" })) };
}
