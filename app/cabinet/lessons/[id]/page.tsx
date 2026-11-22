import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "../../../../lib/auth";
import { workPath } from "../../../../lib/paths";
import { studentAssignment, studentLessonHomework } from "../../../../lib/student";
import { LessonMaterials } from "../../../lesson-card";
import { CabinetFrame } from "../../frame";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccount("student");
  const { id } = await params;
  const assignment = await studentAssignment(user.id, id);
  if (!assignment || assignment.entry_kind !== "lesson") notFound();
  const homework = await studentLessonHomework(user.id, id);
  return <CabinetFrame user={user} view="schedule" title={assignment.content.title}>
    {assignment.cancelled_at && <p className="notice error">Урок отменён.</p>}
    <p><Link href={"/cabinet/schedule?focus=" + encodeURIComponent(id) + "#lesson-" + encodeURIComponent(id)}>← К расписанию</Link></p>
    <LessonMaterials assignment={assignment} />
    {homework.length > 0 && <section className="panel">
      <h2>Домашние задания к уроку</h2>
      <ul>{homework.map(item => <li key={item.id}><Link href={workPath(item.id, "homework")}>{item.content.title}</Link></li>)}</ul>
    </section>}
  </CabinetFrame>;
}
