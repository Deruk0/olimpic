import { first, rows } from "./db";
import type { Assignment, Attachment, Grade, LessonSettings, ProgramKey, ProgramRow, Submission, Trajectory, WorkKind } from "./model";
import { workSections, workStates } from "./work";

const studentScope = "FROM assignments a JOIN groups g ON g.id=a.group_id JOIN members m ON m.group_id=g.id AND m.student=$1 LEFT JOIN submissions s ON s.assignment=a.id AND s.student=m.student";
const projection = "a.*,g.name AS group_name,s.grades,s.answers,COALESCE(s.files,'[]'::jsonb) AS files";
export type StudentAssignment = Assignment & { starts: Date } & Pick<Submission, "grades" | "files" | "answers">;

export async function preparationGoal() {
  const diagnostic = await first<Pick<ProgramRow, "published">>("SELECT published FROM programs WHERE level='diagnostic'");
  return diagnostic?.published?.olympiad || "";
}

export function studentAssignments(student: string) {
  return rows<StudentAssignment>("SELECT " + projection + " " + studentScope + " WHERE a.deleted_at IS NULL AND a.starts IS NOT NULL ORDER BY a.starts,a.id", [student]);
}
export function studentAssignment(student: string, assignment: string) {
  return first<StudentAssignment>("SELECT " + projection + " " + studentScope + " WHERE a.id=$2 AND a.deleted_at IS NULL AND a.starts IS NOT NULL", [student, assignment]);
}
export function studentWorks(assignments: StudentAssignment[]) {
  return assignments.flatMap(assignment => workSections(assignment, assignment).map(work => ({ assignment, ...work })));
}

export type ScheduleWork = { kind: WorkKind; state: keyof typeof workStates; topics: string[]; tasks: { title: string; index: number; completed: boolean }[] };
export type ScheduleCard = {
  id: string; kind: Assignment["kind"]; level: ProgramKey; starts: Date; meeting: string;
  settings: Partial<LessonSettings>; groupName: string; title: string; topic: string;
  topics: string[]; attended: boolean; works: ScheduleWork[];
};
type ScheduleRow = Omit<ScheduleCard, "groupName" | "topics" | "works" | "starts"> & {
  starts: Date | string; group_name: string;
  tasks: { title?: string | null; topic?: string | null; kind?: WorkKind | null; phase?: "before" | "after" | null }[];
  files: Attachment[] | null; grades: (Grade | null)[] | null; answers: Submission["answers"];
};

const scheduleSql = `SELECT a.id, a.kind, a.level, a.starts, a.meeting, a.settings,
  g.name AS group_name,
  COALESCE(a.content->>'title', '') AS title,
  COALESCE(a.content->>'topic', '') AS topic,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('title', task->>'title', 'topic', task->>'topic', 'kind', task->>'kind', 'phase', task->>'phase') ORDER BY ord)
    FROM jsonb_array_elements(COALESCE(a.content->'tasks', '[]'::jsonb)) WITH ORDINALITY AS item(task, ord)
  ), '[]'::jsonb) AS tasks,
  EXISTS(SELECT 1 FROM attendance t WHERE t.assignment = a.id AND t.student = $1) AS attended,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', '', 'name', '', 'task', (file->>'task')::int))
    FROM jsonb_array_elements(COALESCE(s.files, '[]'::jsonb)) AS file
  ), '[]'::jsonb) AS files,
  CASE WHEN jsonb_typeof(s.grades) = 'array' THEN (
    SELECT jsonb_agg(CASE WHEN grade = 'null'::jsonb THEN 'null'::jsonb ELSE '{"score":0,"comment":""}'::jsonb END ORDER BY ord)
    FROM jsonb_array_elements(s.grades) WITH ORDINALITY AS item(grade, ord)
  ) ELSE NULL END AS grades,
  COALESCE((
    SELECT jsonb_object_agg(key, to_jsonb(''::text))
    FROM jsonb_object_keys(COALESCE(s.answers, '{}'::jsonb)) AS key
  ), '{}'::jsonb) AS answers
  FROM assignments a
  JOIN groups g ON g.id = a.group_id
  JOIN members m ON m.group_id = g.id AND m.student = $1
  LEFT JOIN submissions s ON s.assignment = a.id AND s.student = m.student
  WHERE a.deleted_at IS NULL AND a.starts IS NOT NULL
  ORDER BY a.starts, a.id`;

export async function studentSchedule(student: string) {
  const [group, list] = await Promise.all([
    first<{ name: string }>("SELECT g.name FROM groups g JOIN members m ON m.group_id = g.id WHERE m.student = $1", [student]),
    rows<ScheduleRow>(scheduleSql, [student])
  ]);
  const cards = list.map(row => {
    const tasks = row.tasks.map(task => ({ title: task.title ?? "", prompt: "", topic: task.topic ?? "", max: 0, kind: task.kind ?? undefined, phase: task.phase ?? undefined }));
    const works = workSections(
      { kind: row.kind, content: { tasks } } as Assignment,
      { files: row.files ?? [], grades: row.grades, answers: row.answers ?? {} }
    ).map(({ kind, state, tasks: section }) => ({
      kind, state, topics: [...new Set(section.map(({ task }) => task.topic).filter(Boolean))],
      tasks: section.map(({ task, index }) => ({
        title: task.title, index,
        completed: !!row.grades?.[index] || (row.files ?? []).some(file => file.task === index) || Object.hasOwn(row.answers ?? {}, index)
      }))
    }));
    const topics = [...new Set([row.topic, ...tasks.map(task => task.topic)].filter(Boolean))];
    return {
      id: row.id, kind: row.kind, level: row.level, starts: new Date(row.starts), meeting: row.meeting,
      settings: row.settings ?? {}, groupName: row.group_name, title: row.title, topic: row.topic,
      topics, attended: Boolean(row.attended), works
    } satisfies ScheduleCard;
  });
  return { group: group?.name ?? cards[0]?.groupName ?? "", cards };
}
export function studentTrajectory(student: string) {
  return first<Trajectory>("SELECT * FROM trajectories WHERE student=$1", [student]);
}
