import Link from "next/link";
import { requireAccount } from "../../../lib/auth";
import { levels } from "../../../lib/model";
import { workPath } from "../../../lib/paths";
import { studentSchedule, studentTrajectory } from "../../../lib/student";
import { workLabels, workStates } from "../../../lib/work";
import { CabinetFrame } from "../frame";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const user = await requireAccount("student");
  const query = await searchParams;
  const [trajectory, { cards }] = await Promise.all([studentTrajectory(user.id), studentSchedule(user.id)]);
  const lessons = cards.filter(card => card.kind === "lesson" && trajectory && card.level === trajectory.level);
  return <CabinetFrame user={user} view="plan" title="Траектория" saved={query.saved} error={query.error}>
    {trajectory ? <section className="panel schedule-plan">
      <div className="split"><h2>{user.goal || "План подготовки"}</h2><span className="badge">{levels[trajectory.level]}</span></div>
      <ol className="timeline">{trajectory.topics.map((topic, index) => {
        const work = lessons.flatMap(card => card.works.filter(item => item.topics.includes(topic.name)).map(item => ({ card, ...item })));
        const reviewed = work.filter(item => item.state === "reviewed").length;
        return <li key={topic.name}><b>{index + 1}. {topic.name}</b><span>До {topic.due.split("-").reverse().join(".")} · {work.length ? reviewed + " из " + work.length + " проверено" : "Занятие готовится"}</span>
          {work.map(({ card, kind, state }) => <span key={card.id + kind}><Link href={workPath(card.id, kind)}>{card.title} · {workLabels[kind]}</Link> · {workStates[state]}</span>)}
        </li>;
      })}</ol>
      <Link href="/cabinet/schedule">Перейти к расписанию →</Link>
    </section> : <p className="panel muted">Куратор опубликует план после диагностики. <Link href="/cabinet/schedule">Открыть расписание</Link></p>}
  </CabinetFrame>;
}
