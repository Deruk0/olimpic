import Link from "next/link";
import { requireAccount } from "../../../lib/auth";
import { workPath, lessonPath } from "../../../lib/paths";
import { studentAssignments, studentWorks } from "../../../lib/student";
import { workLabels, workStates } from "../../../lib/work";
import { CabinetFrame } from "../frame";
import { InterfaceIcon } from "../../interface-icons";
import { EmptyList, ListFilters } from "../../list-filters";

const filters = { all: "Все", ...workStates };
const types = { all: "Все типы", ...workLabels };
export default async function HomeworkIndex({ searchParams }: { searchParams: Promise<{ status?: string; kind?: string; q?: string; sort?: string }> }) {
  const user = await requireAccount("student");
  const assignments = await studentAssignments(user.id);
  const { status, kind, q, sort: requestedSort } = await searchParams;
  const active = typeof status === "string" && Object.hasOwn(filters, status) ? status : "all";
  const activeKind = typeof kind === "string" && Object.hasOwn(types, kind) ? kind : "all";
  const search = typeof q === "string" ? q.trim().slice(0, 120) : "";
  const sort = requestedSort === "oldest" || requestedSort === "title" ? requestedSort : "newest";
  const visible = studentWorks(assignments).filter(work =>
    (active === "all" || active === work.state) && (activeKind === "all" || activeKind === work.kind) &&
    work.assignment.content.title.toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru"))
  ).sort((a, b) => sort === "title" ? a.assignment.content.title.localeCompare(b.assignment.content.title, "ru") :
    (new Date(a.assignment.starts).getTime() - new Date(b.assignment.starts).getTime()) * (sort === "oldest" ? 1 : -1));
  return <CabinetFrame user={user} view="homework" title="Учебные работы">
    <p className="muted">Практика, домашние и самостоятельные работы по занятиям вашей группы.</p>
    <ListFilters action="/cabinet/homework" search={search} placeholder="Название занятия" reset="/cabinet/homework" count={visible.length} filters={[
      { name: "kind", label: "Тип работы", value: activeKind, options: Object.entries(types) },
      { name: "status", label: "Статус", value: active, options: Object.entries(filters) },
      { name: "sort", label: "Сортировка", value: sort, options: [["newest", "Сначала новые"], ["oldest", "Сначала ранние"], ["title", "По названию · А–Я"]] },
    ]} />
    {visible.length === 0 && <EmptyList reset="/cabinet/homework" />}
    {visible.map(({ assignment, kind, tasks, state }) => <article className="panel list-card" key={assignment.id + kind}>
      <div className="split"><h2 className="section-title"><InterfaceIcon name="homework" /><Link href={workPath(assignment.id, kind)}>{assignment.content.title}</Link></h2><span className="badge">{workStates[state]}</span></div>
      <div className="split"><span className="muted">{workLabels[kind]} · заданий: {tasks.length}</span><div className="controls">
        <Link className="button secondary" href={lessonPath(assignment.id)}>Материалы занятия</Link>
        <Link className="button" href={workPath(assignment.id, kind)}>{state === "reviewed" ? "Посмотреть результат" : state === "awaiting" ? "Посмотреть работу" : "Открыть задания"}</Link>
      </div></div>
    </article>)}
  </CabinetFrame>;
}
