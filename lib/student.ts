import { first, rows } from "./db";
import type { Assignment, Submission, WorkKind } from "./model";
import { workLabels, workSections, workStates } from "./work";

const studentScope = `SELECT a.*,t.name AS teacher_name,l.content->>'title' AS lesson_title,s.grades,s.answers,
  COALESCE(s.files,'[]'::jsonb) AS files
  FROM assignments a
  JOIN accounts t ON t.id=a.teacher_id
  LEFT JOIN assignments l ON l.id=a.lesson_id
  LEFT JOIN submissions s ON s.assignment=a.id AND s.student=a.student_id
  WHERE a.student_id=$1`;

export type StudentAssignment = Assignment & { teacher_name: string; lesson_title: string | null } &
  Pick<Submission, "grades" | "files" | "answers">;

export function studentAssignments(student: string) {
  return rows<StudentAssignment>(studentScope + " ORDER BY a.starts,a.id", [student]);
}

export function studentAssignment(student: string, assignment: string) {
  return first<StudentAssignment>(studentScope + " AND a.id=$2", [student, assignment]);
}

export function studentWorks(assignments: StudentAssignment[], now = Date.now()) {
  return assignments.flatMap(assignment => workSections(assignment, assignment, now).map(work => ({ assignment, ...work })));
}

export function studentLessonHomework(student: string, lesson: string) {
  return rows<StudentAssignment>(studentScope + " AND a.lesson_id=$2 ORDER BY a.due_at,a.id", [student, lesson]);
}

type ScheduleWork = {
  assignmentId: string;
  title: string;
  kind: WorkKind;
  state: keyof typeof workStates;
  tasks: { title: string; index: number; completed: boolean }[];
};

export type ScheduleCard = Pick<Assignment, "id" | "starts" | "settings"> & {
  teacherName: string;
  title: string;
  topics: string[];
  cancelled: boolean;
  works: ScheduleWork[];
};

export async function studentSchedule(student: string): Promise<ScheduleCard[]> {
  const assignments = await studentAssignments(student);
  const linked = new Map<string, StudentAssignment[]>();
  for (const assignment of assignments) {
    if (assignment.lesson_id) {
      const entries = linked.get(assignment.lesson_id);
      if (entries) entries.push(assignment);
      else linked.set(assignment.lesson_id, [assignment]);
    }
  }
  return assignments.filter(assignment => assignment.entry_kind === "lesson").map(assignment => {
    const { id, starts, settings, content } = assignment;
    const works = [assignment, ...(linked.get(id) ?? [])].flatMap(item => {
      const files = new Set(item.files.map(file => file.task));
      return workSections(item, item).map(({ kind, state, tasks }) => ({
        assignmentId: item.id,
        title: item.content.work?.[kind]?.title ?? workLabels[kind],
        kind,
        state,
        tasks: tasks.map(({ task, index }) => ({
          title: task.title,
          index,
          completed: !!item.grades?.[index] || files.has(index) || Object.hasOwn(item.answers ?? {}, index)
        }))
      }));
    });
    return {
      id, starts: new Date(starts), settings, works, cancelled: !!assignment.cancelled_at,
      title: content.title,
      teacherName: assignment.teacher_name,
      topics: [...new Set([content.topic, ...content.tasks.map(task => task.topic)].filter(Boolean))]
    };
  });
}
