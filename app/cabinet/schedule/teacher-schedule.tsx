import Link from "next/link";
import { notFound } from "next/navigation";
import type { SessionAccount } from "../../../lib/auth";
import { rows } from "../../../lib/db";
import { formatLessonTime, lessonEnd, lessonTimeInput } from "../../../lib/lesson-time";
import { formats } from "../../../lib/model";
import { reviewPath } from "../../../lib/paths";
import { linkedStudents, teacherAssignments } from "../../../lib/teacher";
import { CabinetFrame } from "../frame";
import { LessonForm } from "./lesson-form";
import { JoinLesson } from "./join-lesson";
import { cancelLesson } from "../teacher-actions";
import { Submit } from "../../components";

export type ScheduleQuery = { saved?: string; error?: string; focus?: string; archive?: string; edit?: string; new?: string; student?: string };

export async function TeacherSchedule({ teacher, query }: { teacher: SessionAccount; query: ScheduleQuery }) {
  const [students, assignments, theory] = await Promise.all([
    linkedStudents(teacher.id),
    teacherAssignments(teacher.id),
    query.new === "1" ? rows<{ id: string; title: string }>(
      "SELECT id,title FROM library_items WHERE teacher_id=$1 AND kind='theory' AND ready ORDER BY title", [teacher.id]) : []
  ]);
  const lessons = assignments.filter(item => item.entry_kind === "lesson");
  const editing = query.edit ? lessons.find(lesson => lesson.id === query.edit && !lesson.cancelled_at) : undefined;
  if (query.edit && !editing) notFound();
  const creating = query.new === "1" && !editing;
  const now = Date.now();
  const upcoming = lessons.filter(lesson => lessonEnd(new Date(lesson.starts).getTime(), lesson.settings.duration) >= now);
  const shown = new Set(upcoming.map(lesson => lesson.id));
  const past = lessons.filter(lesson => !shown.has(lesson.id)).reverse();
  return <CabinetFrame user={teacher} view="schedule" title="Расписание уроков" saved={query.saved} error={query.error}>
    {(creating || editing) ? <section className="panel">
      <div className="split"><h2>{editing ? "Изменить урок" : "Новый урок"}</h2><Link href="/cabinet/schedule">К расписанию</Link></div>
      {(editing || students.length > 0) ? <LessonForm key={editing?.id ?? query.student ?? "new"} studentName={editing?.student_name}
        students={students} theories={theory} initial={{
          id: editing?.id,
          student: students.find(student => student.id === query.student)?.id ?? "",
          title: editing?.content.title ?? "",
          theory: "",
          starts: editing ? lessonTimeInput(editing.starts) : "",
          duration: String(editing?.settings.duration ?? 60),
          format: editing?.settings.format ?? "online",
          location: editing?.settings.location ?? ""
        }} /> : <p className="muted">Для назначения урока нужен привязанный ученик.</p>}
    </section> : <div className="controls"><Link className="button" href="/cabinet/schedule?new=1">Назначить урок</Link></div>}
    {([
      ["Ближайшие уроки", upcoming],
      ["Прошедшие уроки", past]
    ] as const).map(([label, group]) => <section key={label}>
      <h2 className="schedule-heading">{label}</h2>
      {!group.length && <p className="panel muted">Уроков пока нет.</p>}
      {group.map(lesson => <article key={lesson.id} className="panel list-card">
        <div className="split"><div><h3>{lesson.content.title}</h3>
          <p className="muted">{lesson.student_name} · {formatLessonTime(lesson.starts)} · {lesson.settings.duration ?? 90} мин</p>
        </div>{lesson.cancelled_at ? <span className="badge badge-danger">Урок отменён</span> :
          <span className="badge">{formats[lesson.settings.format ?? "online"]}</span>}</div>
        {!lesson.cancelled_at && <div className="controls">
          <Link className="button secondary" href={"/cabinet/schedule?edit=" + encodeURIComponent(lesson.id)}>Изменить</Link>
          {students.some(student => student.id === lesson.student_id) &&
            <Link className="button" href={"/cabinet/review/issue?lesson=" + encodeURIComponent(lesson.id)}>Выдать ДЗ к уроку</Link>}
        </div>}
        {!lesson.cancelled_at && shown.has(lesson.id) && <details className="material">
          <summary>Отменить урок</summary>
          <form action={cancelLesson.bind(null, lesson.id)} className="controls">
            <span className="muted">Урок будет отмечен как отменённый у обоих участников.</span>
            <Submit secondary>Подтвердить отмену</Submit>
          </form>
        </details>}
        {!lesson.cancelled_at && (lesson.settings.format ?? "online") === "online" && <JoinLesson id={lesson.id} format="online" now={now}
          starts={new Date(lesson.starts).getTime()} ends={lessonEnd(new Date(lesson.starts).getTime(), lesson.settings.duration)} />}
        {assignments.filter(item => item.lesson_id === lesson.id).map(item =>
          <p key={item.id}><Link href={reviewPath(item.id, "homework")}>{item.content.title}</Link></p>)}
      </article>)}
    </section>)}
  </CabinetFrame>;
}
