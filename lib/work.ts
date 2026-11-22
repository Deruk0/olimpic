import type { Assignment, Submission, Task, WorkKind } from "./model";

export const workLabels = {
  practice: "Практика",
  homework: "Домашняя работа",
  assessment: "Самостоятельная работа"
};
export const workKinds = ["practice", "homework", "assessment"] as const;

export function workKind(task: Task): WorkKind {
  return task.kind ?? (task.phase === "before" ? "practice" : "homework");
}
export function workTasks(assignment: Assignment, kind: WorkKind) {
  return assignment.content.tasks.flatMap((task, index) =>
    workKind(task) === kind ? [{ task, index }] : []);
}
type WorkTasks = ReturnType<typeof workTasks>;
export type WorkSubmission = Pick<Submission, "files" | "grades" | "answers">;

export function workTitle(assignment: Assignment, kind: WorkKind) {
  return assignment.content.work?.[kind]?.title || assignment.content.title;
}

export function workDeadline(assignment: Assignment, kind: WorkKind) {
  if (kind !== "homework") return null;
  if (assignment.due_at) return new Date(assignment.due_at);
  const days = assignment.content.work?.homework?.dueDays;
  return days === undefined ? null : new Date(new Date(assignment.starts).getTime() + days * 86_400_000);
}

export function workSections(assignment: Assignment, submission?: WorkSubmission, now = Date.now()) {
  return workKinds.flatMap(kind => {
    const tasks = workTasks(assignment, kind);
    const deadline = workDeadline(assignment, kind);
    return tasks.length ? [{ kind, tasks, deadline, state: workStatus(tasks, submission, deadline, now) }] : [];
  });
}
export function workState(tasks: WorkTasks, submission?: WorkSubmission): "reviewed" | "awaiting" | "pending" {
  const fileIndexes = new Set(submission?.files.map(file => file.task));
  if (tasks.length && tasks.every(({ index }) => submission?.grades?.[index])) return "reviewed";
  if (tasks.length && tasks.every(({ index }) => fileIndexes.has(index) || Object.hasOwn(submission?.answers ?? {}, index))) return "awaiting";
  return "pending";
}

export function workStatus(tasks: WorkTasks, submission: WorkSubmission | undefined, deadline: Date | null, now = Date.now()): keyof typeof workStates {
  const state = workState(tasks, submission);
  return state === "pending" && deadline && deadline.getTime() <= now ? "overdue" : state;
}

export function workScore(tasks: WorkTasks, submission: WorkSubmission) {
  const graded = tasks.flatMap(({ task, index }) => {
    const grade = submission.grades?.[index];
    return grade ? [{ title: task.title, index, ...grade }] : [];
  });
  return {
    graded,
    score: graded.reduce((sum, grade) => sum + grade.score, 0),
    total: tasks.reduce((sum, { task }) => sum + task.max, 0)
  };
}

export const workStates = { pending: "Выдано", awaiting: "На проверке", reviewed: "Проверено", overdue: "Просрочено" };
