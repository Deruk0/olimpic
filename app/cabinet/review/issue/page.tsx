import Link from "next/link";
import { requireAccount } from "../../../../lib/auth";
import { rows } from "../../../../lib/db";
import { formatLessonTime } from "../../../../lib/lesson-time";
import { linkedStudents, teacherAssignments } from "../../../../lib/teacher";
import { CabinetFrame } from "../../frame";
import { IssueForm } from "./issue-form";

export default async function IssuePage({ searchParams }: { searchParams: Promise<{ student?: string; lesson?: string; template?: string; error?: string }> }) {
  const teacher = await requireAccount("teacher");
  const [query, students, assignments, templates] = await Promise.all([
    searchParams,
    linkedStudents(teacher.id),
    teacherAssignments(teacher.id),
    rows<{ id: string; title: string }>("SELECT id,title FROM library_items WHERE teacher_id=$1 AND kind='work' AND ready AND data->>'kind'='homework' ORDER BY title,id", [teacher.id])
  ]);
  const lessons = assignments.filter(item => item.entry_kind === "lesson" && !item.cancelled_at).map(item => ({
    id: item.id, student: item.student_id, label: item.content.title + " · " + formatLessonTime(item.starts)
  }));
  const lesson = lessons.find(item => item.id === query.lesson);
  return <CabinetFrame user={teacher} view="review" title="Выдать домашнее задание" error={query.error}>
    <p><Link href="/cabinet/review">← К проверке работ</Link></p>
    <section className="panel">
      {!students.length && <p>Сначала привяжите ученика.</p>}
      {!templates.length && <p><Link href="/cabinet/library?kind=work">Соберите и отметьте готовым шаблон ДЗ в библиотеке.</Link></p>}
      {!!students.length && !!templates.length && <IssueForm students={students} templates={templates} lessons={lessons}
        initialStudent={lesson?.student ?? query.student} initialLesson={lesson?.id} initialTemplate={query.template} />}
    </section>
  </CabinetFrame>;
}
