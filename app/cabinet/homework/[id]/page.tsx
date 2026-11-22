import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "../../../../lib/auth";
import { lessonPath, workPath } from "../../../../lib/paths";
import { studentAssignment, studentLessonHomework } from "../../../../lib/student";
import { workSections, workTitle } from "../../../../lib/work";
import { CabinetFrame } from "../../frame";
import { WorkBadge } from "../../work-badge";

export default async function LessonWorks({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccount("student");
  const { id } = await params;
  const assignment = await studentAssignment(user.id, id);
  if (!assignment || assignment.entry_kind !== "lesson") notFound();
  const linked = await studentLessonHomework(user.id, id);
  const sections = [assignment, ...linked].flatMap(item => workSections(item, item).map(work => ({ item, ...work })));
  return <CabinetFrame user={user} view="homework" title={assignment.content.title}>
    <p className="controls"><Link href="/cabinet/homework">← Все работы</Link><Link href={lessonPath(id)}>К занятию →</Link></p>
    {!sections.length && <p className="panel muted">К этому занятию пока нет работ.</p>}
    {sections.map(({ item, kind, tasks, state }) => <article className="panel split" key={item.id + kind}>
      <div><h2><Link href={workPath(item.id, kind)}>{workTitle(item, kind)}</Link></h2><span className="muted">Заданий: {tasks.length}</span></div>
      <WorkBadge state={state} />
    </article>)}
  </CabinetFrame>;
}
