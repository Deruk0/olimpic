import Link from "next/link";
import { requireAccount } from "../../../lib/auth";
import { formatLessonTime } from "../../../lib/lesson-time";
import { workPath, lessonPath } from "../../../lib/paths";
import { studentAssignments, studentWorks } from "../../../lib/student";
import { workLabels, workScore, workStates, workTitle } from "../../../lib/work";
import { CabinetFrame } from "../frame";
import { InterfaceIcon } from "../../interface-icons";
import { EmptyList, ListFilters } from "../../list-filters";
import { WorkBadge } from "../work-badge";

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
    (workTitle(work.assignment, work.kind) + " " + work.assignment.teacher_name).toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru"))
  ).sort((a, b) => sort === "title" ? workTitle(a.assignment, a.kind).localeCompare(workTitle(b.assignment, b.kind), "ru") :
    (new Date(a.assignment.starts).getTime() - new Date(b.assignment.starts).getTime()) * (sort === "oldest" ? 1 : -1));
  return <CabinetFrame user={user} view="homework" title="Домашние задания">
    <ListFilters action="/cabinet/homework" search={search} placeholder="Название или преподаватель" reset="/cabinet/homework" count={visible.length} filters={[
      { name: "kind", label: "Тип работы", value: activeKind, options: Object.entries(types) },
      { name: "status", label: "Статус", value: active, options: Object.entries(filters) },
      { name: "sort", label: "Сортировка", value: sort, options: [["newest", "Сначала новые"], ["oldest", "Сначала ранние"], ["title", "По названию · А–Я"]] },
    ]} />
    {visible.length === 0 && <EmptyList reset="/cabinet/homework" />}
    {visible.map(({ assignment, kind, tasks, deadline, state }) => {
      const { score, total, graded } = workScore(tasks, assignment);
      const lesson = assignment.lesson_id ?? (assignment.entry_kind === "lesson" ? assignment.id : null);
      const path = workPath(assignment.id, kind);
      return <article className="panel list-card" key={assignment.id + kind}>
        <div className="split"><h2 className="section-title"><InterfaceIcon name="homework" /><Link href={path}>{workTitle(assignment, kind)}</Link></h2><WorkBadge state={state} /></div>
        <p className="muted">{assignment.teacher_name} · {workLabels[kind]} · заданий {tasks.length}</p>
        <div className="split">
          <div>{deadline && <p>Сдать до <time dateTime={deadline.toISOString()}>{formatLessonTime(deadline)}</time></p>}
            {!!graded.length && <p><strong>{score} / {total} б.</strong>{graded.length < tasks.length && " · Проверено " + graded.length + " из " + tasks.length}</p>}
          </div>
          <div className="controls">
            {lesson && <Link className="button secondary" href={lessonPath(lesson)}>К уроку</Link>}
            <Link className="button" href={path}>{state === "reviewed" ? "Посмотреть результат" : state === "awaiting" ? "Посмотреть работу" :
              state === "overdue" ? "Сдать с опозданием" : "Открыть задания"}</Link>
          </div>
        </div>
        {graded.some(grade => grade.comment) && <details>
          <summary>Комментарии к заданиям</summary>
          <ul>{graded.filter(grade => grade.comment).map(grade => <li key={grade.index}><b>{grade.title}</b> · {grade.comment}</li>)}</ul>
        </details>}
      </article>;
    })}
  </CabinetFrame>;
}
