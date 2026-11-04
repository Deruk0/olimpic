import { first, rows } from "./db";
import type { Assignment, Submission } from "./model";
import { workSections } from "./work";

const studentScope = "FROM assignments a JOIN groups g ON g.id=a.group_id JOIN members m ON m.group_id=g.id AND m.student=$1 LEFT JOIN submissions s ON s.assignment=a.id AND s.student=m.student";
const projection = "a.*,g.name AS group_name,s.grades,s.answers,COALESCE(s.files,'[]'::jsonb) AS files";
export type StudentAssignment = Assignment & Pick<Submission, "grades" | "files" | "answers">;

export function studentAssignments(student: string) {
  return rows<StudentAssignment>("SELECT " + projection + " " + studentScope + " ORDER BY a.starts,a.id", [student]);
}
export function studentAssignment(student: string, assignment: string) {
  return first<StudentAssignment>("SELECT " + projection + " " + studentScope + " WHERE a.id=$2", [student, assignment]);
}
export function studentWorks(assignments: StudentAssignment[]) {
  return assignments.flatMap(assignment => workSections(assignment, assignment).map(work => ({ assignment, ...work })));
}
