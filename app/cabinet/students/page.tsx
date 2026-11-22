import Link from "next/link";
import { requireAccount } from "../../../lib/auth";
import { linkedStudents } from "../../../lib/teacher";
import { CabinetFrame } from "../frame";

export default async function StudentsPage() {
  const teacher = await requireAccount("teacher");
  const students = await linkedStudents(teacher.id);
  return <CabinetFrame user={teacher} view="students" title="Мои ученики">
    {!students.length && <p className="panel muted">У вас пока нет привязанных учеников.</p>}
    {students.map(student => <article className="panel list-card split" key={student.id}>
      <h2>{student.name}</h2>
      <div className="controls">
        <Link className="button secondary" href={"/cabinet/schedule?new=1&student=" + encodeURIComponent(student.id)}>Назначить урок</Link>
        <Link className="button" href={"/cabinet/review/issue?student=" + encodeURIComponent(student.id)}>Выдать ДЗ</Link>
      </div>
    </article>)}
  </CabinetFrame>;
}
