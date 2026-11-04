import Link from "next/link";
import { requireAccount } from "../../../lib/auth";
import { workPath, lessonPath } from "../../../lib/paths";
import { studentAssignments, studentWorks } from "../../../lib/student";
import { workLabels, workStates } from "../../../lib/work";
import { CabinetFrame } from "../frame";

const filters = { all: "Все", ...workStates };
const types = { all: "Все типы", ...workLabels };
export default async function HomeworkIndex({ searchParams }: { searchParams: Promise<{ status?: string; kind?: string }> }) {
  const user = await requireAccount("student");
  const assignments = await studentAssignments(user.id);
  const { status, kind } = await searchParams;
  const active = typeof status === "string" && Object.hasOwn(filters, status) ? status : "all";
  const activeKind = typeof kind === "string" && Object.hasOwn(types, kind) ? kind : "all";
  const visible = studentWorks(assignments).filter(work => (active === "all" || active === work.state) && (activeKind === "all" || activeKind === work.kind));
  const href = (state: string, type: string) => "/cabinet/homework?status=" + state + "&kind=" + type;
  return <CabinetFrame user={user} view="homework" title="Учебные работы">
    <p className="muted">Практика, домашние и самостоятельные работы по занятиям вашей группы.</p>
    <div className="chips" aria-label="Тип работы">{Object.entries(types).map(([value, label]) =>
      <Link className={activeKind === value ? "active" : ""} aria-current={activeKind === value ? "page" : undefined} key={value} href={href(active, value)}>{label}</Link>
    )}</div>
    <div className="chips" aria-label="Статус работы">{Object.entries(filters).map(([value, label]) =>
      <Link className={active === value ? "active" : ""} aria-current={active === value ? "page" : undefined} key={value} href={href(value, activeKind)}>{label}</Link>
    )}</div>
    {!visible.length && <p className="panel muted">Работ по выбранным фильтрам пока нет.</p>}
    {visible.map(({ assignment, kind, tasks, state }) => <article className="panel" key={assignment.id + kind}>
      <div className="split"><h2><Link href={workPath(assignment.id, kind)}>{assignment.content.title}</Link></h2><span className="badge">{workStates[state]}</span></div>
      <div className="split"><span className="muted">{workLabels[kind]} · заданий: {tasks.length}</span><Link href={lessonPath(assignment.id)}>Материалы занятия →</Link></div>
    </article>)}
  </CabinetFrame>;
}
