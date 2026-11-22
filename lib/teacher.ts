import { first, rows } from "./db";
import type { Assignment } from "./model";
import type { WorkSubmission } from "./work";

export function linkedStudents(teacherId: string) {
  return rows<{ id: string; name: string }>(
    "SELECT a.id,a.name FROM teacher_students ts JOIN accounts a ON a.id=ts.student_id WHERE ts.teacher_id=$1 ORDER BY a.name,a.id",
    [teacherId]);
}

export type TeacherAssignment = Assignment & WorkSubmission & { student_name: string; lesson_title: string | null };
const teacherScope = `SELECT a.*,u.name AS student_name,l.content->>'title' AS lesson_title,
  COALESCE(s.files,'[]'::jsonb) AS files,s.answers,s.grades
  FROM assignments a
  JOIN accounts u ON u.id=a.student_id
  LEFT JOIN assignments l ON l.id=a.lesson_id
  LEFT JOIN submissions s ON s.assignment=a.id AND s.student=a.student_id
  WHERE a.teacher_id=$1`;

export function teacherAssignments(teacherId: string) {
  return rows<TeacherAssignment>(teacherScope + " ORDER BY a.starts,a.id", [teacherId]);
}

export function teacherAssignment(teacherId: string, id: string) {
  return first<TeacherAssignment>(teacherScope + " AND a.id=$2", [teacherId, id]);
}
