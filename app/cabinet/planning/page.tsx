import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "../../../lib/auth";
import { first, rows } from "../../../lib/db";
import { libraryPath, planningPath, type LibraryEntry } from "../../../lib/library";
import type { Assignment, Group } from "../../../lib/model";
import { PlanningEditor } from "../../library-editor";
import { CabinetFrame } from "../frame";
import { EmptyList, ListFilters } from "../../list-filters";

const date = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Moscow" });
type Planned = Assignment & { has_work: boolean; curator_name: string };
const projection = "SELECT a.*,g.name AS group_name,c.name AS curator_name,EXISTS(SELECT 1 FROM submissions s WHERE s.assignment=a.id) AS has_work FROM assignments a JOIN groups g ON g.id=a.group_id JOIN accounts c ON c.id=g.curator WHERE a.kind='lesson' AND a.deleted_at IS NULL";

export default async function PlanningPage({ searchParams }: { searchParams: Promise<{ id?: string; saved?: string; group?: string; q?: string; status?: string; sort?: string }> }) {
  const user = await requireAccount("methodist");
  const query = await searchParams;
  const [groups, assignment] = await Promise.all([
    rows<Group>("SELECT * FROM groups ORDER BY name"),
    query.id && query.id !== "new" ? first<Planned>(projection + " AND a.id=$1", [query.id]) : undefined
  ]);
  if (query.id && query.id !== "new" && !assignment) notFound();
  const canEdit = !assignment || (!assignment.has_work && (!assignment.starts || new Date(assignment.starts).getTime() > Date.now()));
  const items = query.id && canEdit ? await rows<LibraryEntry>("SELECT id,kind,title,ready,data FROM library_items WHERE ready AND kind IN ('theory','work') ORDER BY title") : [];
  const chosenGroup = groups.find(group => group.id === query.group);
  const assignments = query.id ? [] : await rows<Planned>(projection + (chosenGroup ? " AND a.group_id=$1" : "") + " ORDER BY (a.starts IS NOT NULL), (a.starts<=now()), CASE WHEN a.starts>now() THEN a.starts END, a.starts DESC, a.id", chosenGroup ? [chosenGroup.id] : []);
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";
  const status = ["undated", "upcoming", "past"].includes(query.status ?? "") ? query.status! : "all";
  const sort = query.sort === "title" || query.sort === "newest" ? query.sort : "schedule";
  const now = Date.now();
  const visible = assignments.filter(item => {
    const end = item.starts ? new Date(item.starts).getTime() + (item.settings.duration ?? 90) * 60_000 : 0;
    return (status === "all" || (status === "undated" ? !item.starts : !!item.starts && (status === "past" ? end <= now : end > now))) &&
      (item.content.title + " " + item.group_name + " " + item.curator_name).toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru"));
  });
  if (sort === "title") visible.sort((a, b) => a.content.title.localeCompare(b.content.title, "ru") || a.id.localeCompare(b.id));
  if (sort === "newest") visible.sort((a, b) => (b.starts ? new Date(b.starts).getTime() : 0) - (a.starts ? new Date(a.starts).getTime() : 0));
  return <CabinetFrame user={user} view="planning" title="Расписание групп" saved={query.saved}>
    {query.id ? <section className="panel">
      <p><Link href={planningPath()}>← К расписанию</Link></p>
      <h2>{assignment ? assignment.content.title : "Новое занятие"}</h2>
      {assignment && <p className="muted">{assignment.group_name} · куратор {assignment.curator_name} · {assignment.starts ? date.format(new Date(assignment.starts)) + " МСК" : "Ожидает даты от куратора"}</p>}
      {!canEdit ? <p className="notice">Занятие уже началось или по нему сдали работу. Его материалы сохранены для истории и проверки.</p> :
        !assignment && !items.some(item => item.kind === "theory") ? <p>Сначала <Link href={libraryPath("theory", "new")}>создайте готовую теорию</Link>.</p> :
          !groups.length ? <p>Сначала добавьте группу с назначенным куратором.</p> :
            <PlanningEditor key={query.id + ":" + (assignment?.revision ?? 0)} assignment={assignment} groups={groups} items={items} preferredGroup={chosenGroup?.id} />}
    </section> : <>
      <div className="list-heading"><p className="muted">Назначьте группе готовые материалы. Дату и настройки проведения укажет куратор.</p><Link className="button" href={planningPath("new") + (chosenGroup ? "&group=" + encodeURIComponent(chosenGroup.id) : "")}>+ Назначить занятие</Link></div>
      <ListFilters action="/cabinet/planning" search={search} placeholder="Занятие, группа или куратор" reset={planningPath()} count={visible.length} filters={[
        { name: "group", label: "Группа", value: chosenGroup?.id ?? "", options: [["", "Все группы"], ...groups.map(group => [group.id, group.name] as const)] },
        { name: "status", label: "Проведение", value: status, options: [["all", "Все занятия"], ["undated", "Ожидают даты"], ["upcoming", "Предстоящие и текущие"], ["past", "Прошедшие"]] },
        { name: "sort", label: "Сортировка", value: sort, options: [["schedule", "По расписанию"], ["newest", "Сначала поздние даты"], ["title", "По названию · А–Я"]] },
      ]} />
      {!visible.length && <EmptyList reset={planningPath()} />}
      {visible.map(item => <article className="panel split list-card" key={item.id}><div>
        <h2><Link href={planningPath(item.id)}>{item.content.title}</Link></h2>
        <p className="muted">{item.group_name} · куратор {item.curator_name}</p>
        <span className={"badge" + (item.starts ? " badge-neutral" : "")}>{item.starts ? date.format(new Date(item.starts)) + " МСК" : "Ожидает даты от куратора"}</span>
      </div><Link className="button secondary" href={planningPath(item.id)}>{!item.has_work && (!item.starts || new Date(item.starts).getTime() > now) ? "Настроить материалы" : "Посмотреть занятие"}</Link></article>)}
    </>}
  </CabinetFrame>;
}
