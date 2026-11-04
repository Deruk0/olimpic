import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "../../../lib/auth";
import { first, rows } from "../../../lib/db";
import { libraryPath, planningPath, type LibraryEntry } from "../../../lib/library";
import type { Assignment, Group } from "../../../lib/model";
import { PlanningEditor } from "../../library-editor";
import { CabinetFrame } from "../frame";

const date = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Moscow" });
type Planned = Assignment & { has_work: boolean; curator_name: string };
const projection = "SELECT a.*,g.name AS group_name,c.name AS curator_name,EXISTS(SELECT 1 FROM submissions s WHERE s.assignment=a.id) AS has_work FROM assignments a JOIN groups g ON g.id=a.group_id JOIN accounts c ON c.id=g.curator WHERE a.kind='lesson'";

export default async function PlanningPage({ searchParams }: { searchParams: Promise<{ id?: string; saved?: string; group?: string }> }) {
  const user = await requireAccount("methodist");
  const query = await searchParams;
  const [groups, assignment] = await Promise.all([
    rows<Group>("SELECT * FROM groups ORDER BY name"),
    query.id && query.id !== "new" ? first<Planned>(projection + " AND a.id=$1", [query.id]) : undefined
  ]);
  if (query.id && query.id !== "new" && !assignment) notFound();
  const canEdit = !assignment || (!assignment.has_work && new Date(assignment.starts).getTime() > Date.now());
  const items = query.id && canEdit ? await rows<LibraryEntry>("SELECT id,kind,title,ready,data FROM library_items WHERE ready AND kind IN ('theory','work') ORDER BY title") : [];
  const chosenGroup = groups.find(group => group.id === query.group);
  const assignments = query.id ? [] : await rows<Planned>(projection + (chosenGroup ? " AND a.group_id=$1" : "") + " ORDER BY (a.starts<=now()), CASE WHEN a.starts>now() THEN a.starts END, a.starts DESC", chosenGroup ? [chosenGroup.id] : []);
  return <CabinetFrame user={user} view="planning" title="Расписание групп" saved={query.saved}>
    {query.id ? <section className="panel">
      <p><Link href={planningPath()}>← К расписанию</Link></p>
      <h2>{assignment ? assignment.content.title : "Новое занятие"}</h2>
      {assignment && <p className="muted">{assignment.group_name} · куратор {assignment.curator_name} · {date.format(new Date(assignment.starts))} МСК</p>}
      {!canEdit ? <p className="notice">Занятие уже началось или по нему сдали работу. Его материалы сохранены для истории и проверки.</p> :
        !assignment && !items.some(item => item.kind === "theory") ? <p>Сначала <Link href={libraryPath("theory", "new")}>создайте готовую теорию</Link>.</p> :
          !groups.length ? <p>Сначала добавьте группу с назначенным куратором.</p> :
            <PlanningEditor key={query.id + ":" + (assignment?.revision ?? 0)} assignment={assignment} groups={groups} items={items} preferredGroup={chosenGroup?.id} />}
    </section> : <>
      <div className="split"><p className="muted">Выберите группу и назначьте занятие из готовых материалов.</p><Link className="button" href={planningPath("new") + (chosenGroup ? "&group=" + encodeURIComponent(chosenGroup.id) : "")}>+ Назначить занятие</Link></div>
      <div className="chips" aria-label="Группы"><Link className={!chosenGroup ? "active" : ""} href={planningPath()}>Все группы</Link>
        {groups.map(group => <Link key={group.id} className={chosenGroup?.id === group.id ? "active" : ""} href={planningPath() + "?group=" + encodeURIComponent(group.id)}>{group.name}</Link>)}
      </div>
      {!assignments.length && <p className="panel muted">Занятий пока нет.</p>}
      {assignments.map(item => <article className="panel split" key={item.id}><div>
        <h2><Link href={planningPath(item.id)}>{item.content.title}</Link></h2>
        <p className="muted">{item.group_name} · куратор {item.curator_name}</p>
      </div><span>{date.format(new Date(item.starts))} МСК</span></article>)}
    </>}
  </CabinetFrame>;
}
