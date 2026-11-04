import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "../../../../lib/auth";
import { lessonPath, workPath } from "../../../../lib/paths";
import { studentAssignment } from "../../../../lib/student";
import { workKinds, workLabels, workState, workStates, workTasks } from "../../../../lib/work";
import { CabinetFrame } from "../../frame";

export default async function LessonWorks({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccount("student");
  const { id } = await params;
  const assignment = await studentAssignment(user.id, id);
  if (!assignment) notFound();
  const sections = workKinds.map(kind => ({ kind, tasks: workTasks(assignment, kind) })).filter(section => section.tasks.length);
  return <CabinetFrame user={user} view="homework" title={assignment.content.title}>
    <p className="controls"><Link href="/cabinet/homework">← Все работы</Link><Link href={lessonPath(id)}>К занятию →</Link></p>
    {!sections.length && <p className="panel muted">К этому занятию пока нет работ.</p>}
    {sections.map(({ kind, tasks }) => <article className="panel split" key={kind}>
      <div><h2><Link href={workPath(id, kind)}>{workLabels[kind]}</Link></h2><span className="muted">Заданий: {tasks.length}</span></div>
      <span className="badge">{workStates[workState(tasks, assignment)]}</span>
    </article>)}
  </CabinetFrame>;
}
