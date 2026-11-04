import type { Assignment, Submission, Task, WorkKind } from "./model";

export const workLabels = {
  practice: "Практика",
  homework: "Домашняя работа",
  assessment: "Самостоятельная работа",
  diagnostic: "Диагностика"
};
export const workKinds = ["practice", "homework", "assessment", "diagnostic"] as const;

export function workKind(task: Task, diagnostic: boolean): WorkKind {
  return diagnostic ? "diagnostic" : task.kind ?? (task.phase === "before" ? "practice" : "homework");
}
export function workTasks(assignment: Assignment, kind: WorkKind) {
  return assignment.content.tasks.flatMap((task, index) =>
    workKind(task, assignment.kind === "diagnostic") === kind ? [{ task, index }] : []);
}
export function workSections(assignment: Assignment, submission?: Pick<Submission, "files" | "grades" | "answers">) {
  return workKinds.flatMap(kind => {
    const tasks = workTasks(assignment, kind);
    return tasks.length ? [{ kind, tasks, state: workState(tasks, submission) }] : [];
  });
}
export function workState(tasks: ReturnType<typeof workTasks>, submission?: Pick<Submission, "files" | "grades" | "answers">): keyof typeof workStates {
  const fileIndexes = new Set(submission?.files.map(file => file.task));
  if (tasks.length && tasks.every(({ index }) => submission?.grades?.[index])) return "reviewed";
  if (tasks.length && tasks.every(({ index }) => fileIndexes.has(index) || Object.hasOwn(submission?.answers ?? {}, index))) return "awaiting";
  return "pending";
}
export const workStates = { pending: "К сдаче", awaiting: "На проверке", reviewed: "Проверено" };
