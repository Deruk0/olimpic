import Link from "next/link";
import { requireAccount } from "../../../lib/auth";
import { formatLessonTime } from "../../../lib/lesson-time";
import { reviewPath } from "../../../lib/paths";
import { teacherAssignments } from "../../../lib/teacher";
import { workScore, workSections, workStates, workTitle } from "../../../lib/work";
import { CabinetFrame } from "../frame";
import { WorkBadge } from "../work-badge";

const order = { awaiting: 0, overdue: 1, pending: 2, reviewed: 3 };

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const teacher = await requireAccount("teacher");
  const { status } = await searchParams;
  const active = status && Object.hasOwn(workStates, status) ? status : "all";
  const now = Date.now();
  const assignments = await teacherAssignments(teacher.id);
  const works = assignments.flatMap(assignment => workSections(assignment, assignment, now).map(work => ({ assignment, ...work })));
  const visible = works.filter(work => active === "all" || work.state === active)
    .sort((a, b) => order[a.state] - order[b.state] || new Date(b.assignment.starts).getTime() - new Date(a.assignment.starts).getTime());

  return <CabinetFrame user={teacher} view="review" title="Проверка работ">
    <div className="controls"><Link className="button" href="/cabinet/review/issue">Выдать ДЗ</Link></div>
    <nav className="chips" aria-label="Статусы работ">
      <Link href="/cabinet/review" className={active === "all" ? "active" : ""} aria-current={active === "all" ? "page" : undefined}>Все</Link>
      {Object.entries(workStates).map(([key, label]) =>
        <Link key={key} href={"/cabinet/review?status=" + key} className={active === key ? "active" : ""} aria-current={active === key ? "page" : undefined}>{label}</Link>)}
    </nav>
    {!visible.length && <p className="panel muted">{works.length ? "Работ с таким статусом нет." : "Выданных работ пока нет."}</p>}
    {visible.map(({ assignment, kind, tasks, deadline, state }) => {
      const score = workScore(tasks, assignment);
      return <article className="panel list-card split" key={assignment.id + kind}>
        <div>
          <h2><Link href={reviewPath(assignment.id, kind)}>{workTitle(assignment, kind)}</Link></h2>
          <p className="muted">{assignment.student_name}{deadline && " · До " + formatLessonTime(deadline)}
            {!!score.graded.length && " · " + score.score + " / " + score.total + " б."}</p>
        </div>
        <WorkBadge state={state} />
      </article>;
    })}
  </CabinetFrame>;
}
