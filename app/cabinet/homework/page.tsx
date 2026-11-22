import Link from "next/link";
import { requireAccount } from "../../../lib/auth";
import { formatLessonTime } from "../../../lib/lesson-time";
import { workPath, lessonPath } from "../../../lib/paths";
import { studentAssignments, studentWorks } from "../../../lib/student";
import { workLabels, workScore, workStates, workTitle } from "../../../lib/work";
import { CabinetFrame } from "../frame";
import { InterfaceIcon } from "../../interface-icons";
import { EmptyList } from "../../list-filters";
import { WorkBadge } from "../work-badge";
import "./homework.css";

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
  const hasFilters = activeKind !== "all" || sort !== "newest";
  const works = studentWorks(assignments);
  const visible = works.filter(work =>
    (active === "all" || active === work.state) && (activeKind === "all" || activeKind === work.kind) &&
    (workTitle(work.assignment, work.kind) + " " + work.assignment.teacher_name).toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru"))
  ).sort((a, b) => sort === "title" ? workTitle(a.assignment, a.kind).localeCompare(workTitle(b.assignment, b.kind), "ru") :
    (new Date(a.assignment.starts).getTime() - new Date(b.assignment.starts).getTime()) * (sort === "oldest" ? 1 : -1));
  const toDo = visible.filter(work => work.state === "pending" || work.state === "overdue");
  const sent = visible.filter(work => work.state === "awaiting" || work.state === "reviewed");
  return <CabinetFrame user={user} view="homework" title="Домашние задания">
    <div className="homework-toolbar">
      <nav className="cabinet-tabs" aria-label="Статусы работ">
        {Object.entries(filters).map(([key, label]) => <Link key={key} scroll={false} aria-current={key === active ? "page" : undefined}
          href={{ pathname: "/cabinet/homework", query: { status: key, kind: activeKind, q: search || undefined, sort } }}>{label}</Link>)}
      </nav>
      <form action="/cabinet/homework" method="get" className="homework-filters" key={JSON.stringify([search, active, activeKind, sort])}>
        <input type="hidden" name="status" value={active} />
        <label className="homework-search"><InterfaceIcon name="search" />
          <input type="search" name="q" aria-label="Поиск по названию или преподавателю" defaultValue={search} placeholder="Поиск" maxLength={120} />
        </label>
        <details>
          <summary data-active={hasFilters} aria-label={hasFilters ? "Фильтры активны" : undefined}>Фильтры</summary>
          <div className="homework-filter-options">
            <label>Тип работы<select name="kind" defaultValue={activeKind}>{Object.entries(types).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label>Сортировка<select name="sort" defaultValue={sort}>
              <option value="newest">Сначала новые</option><option value="oldest">Сначала ранние</option><option value="title">По названию</option>
            </select></label>
          </div>
        </details>
        <button className="secondary" type="submit">Показать</button>
      </form>
    </div>
    {visible.length === 0 && (works.length ? <EmptyList reset="/cabinet/homework" /> : <p className="panel muted">Преподаватели пока не выдали вам работы.</p>)}
    {([["Нужно сдать", toDo], ["Отправленные", sent]] as const).map(([title, group]) => group.length > 0 && <section key={title} className="homework-group">
      <h2>{title}</h2>
      <div className="homework-list">
      {group.map(({ assignment, kind, tasks, deadline, state }, index) => {
        const { score, total, graded } = workScore(tasks, assignment);
        const lesson = assignment.lesson_id ?? (assignment.entry_kind === "lesson" ? assignment.id : null);
        const path = workPath(assignment.id, kind);
        const actionable = state === "pending" || state === "overdue";
        return <article className="homework-row" key={assignment.id + kind}>
          <div className="homework-title">
            <InterfaceIcon name="homework" />
            <div><h3><Link href={path}>{workTitle(assignment, kind)}</Link></h3>
              <small>{workLabels[kind]} · заданий {tasks.length}{lesson && <> · <Link href={lessonPath(lesson)}>К уроку</Link></>}</small></div>
          </div>
          <p className="muted homework-teacher">{assignment.teacher_name}</p>
          <div className="homework-dates">
            {deadline && <span>До <time dateTime={deadline.toISOString()}>{formatLessonTime(deadline)}</time></span>}
            {!!graded.length && <small>{score} из {total} б.{graded.length < tasks.length && " · проверено " + graded.length + " из " + tasks.length}</small>}
          </div>
          <div><WorkBadge state={state} /></div>
          <Link className={"button" + (actionable && index === 0 ? "" : " secondary")} href={path}>{state === "reviewed" ? "Результат" : state === "overdue" ? "Сдать" : "Открыть"}</Link>
          {graded.some(grade => grade.comment) && <details className="homework-comments">
            <summary>Комментарии к заданиям</summary>
            <ul>{graded.filter(grade => grade.comment).map(grade => <li key={grade.index}><b>{grade.title}</b> · {grade.comment}</li>)}</ul>
          </details>}
        </article>;
      })}
      </div>
    </section>)}
  </CabinetFrame>;
}
