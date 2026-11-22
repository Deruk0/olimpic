import Link from "next/link";
import { requireAccount } from "../../../lib/auth";
import { workPath } from "../../../lib/paths";
import { studentAssignments, studentWorks } from "../../../lib/student";
import { workLabels, workStates } from "../../../lib/work";
import { CabinetFrame } from "../frame";
import "./statistics.css";

const date = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeZone: "Europe/Moscow" });
const percent = (value: number, total: number) => total ? Math.round(value / total * 100) : 0;

export default async function CoursePage() {
  const user = await requireAccount("student");
  const assignments = await studentAssignments(user.id);
  const now = Date.now();
  const works = studentWorks(assignments, now);
  const started = works.filter(w => new Date(w.assignment.starts).getTime() <= now);
  const pending = started.filter(w => w.state === "pending");
  const awaiting = started.filter(w => w.state === "awaiting");
  const reviewed = started.filter(w => w.state === "reviewed");
  const overdue = started.filter(w => w.state === "overdue");
  const topics = new Map<string, { total: number; submitted: number; graded: number; score: number; max: number }>();
  let score = 0;
  let max = 0;
  let submitted = 0;
  let graded = 0;
  let totalTasks = 0;
  for (const { assignment, tasks } of started) {
    const files = new Set(assignment.files.map(f => f.task));
    for (const { task, index } of tasks) {
      const grade = assignment.grades?.[index];
      const sent = !!grade || files.has(index) || Object.hasOwn(assignment.answers ?? {}, index);
      const name = task.topic.trim() || "Без темы";
      const topic = topics.get(name) ?? { total: 0, submitted: 0, graded: 0, score: 0, max: 0 };
      totalTasks++;
      topic.total++;
      if (sent) { topic.submitted++; submitted++; }
      if (grade) {
        topic.graded++;
        topic.score += grade.score;
        topic.max += task.max;
        score += grade.score;
        max += task.max;
        graded++;
      }
      topics.set(name, topic);
    }
  }
  const orderedTopics = [...topics].sort((a, b) => {
    if (!a[1].graded || !b[1].graded) return Number(!a[1].graded) - Number(!b[1].graded);
    return a[1].score / a[1].max - b[1].score / b[1].max;
  });
  const history = started.filter(w => w.tasks.some(({ index }) => w.assignment.grades?.[index])).toReversed();
  return <CabinetFrame user={user} view="course" title="Моя статистика">
    <p className="muted">Учебные занятия за всё время</p>
    <div className="statistics-metrics">
      <section className="panel"><h2>Сдано работ</h2><strong>{awaiting.length + reviewed.length}<small> / {started.length}</small></strong>
        <progress value={awaiting.length + reviewed.length} max={started.length || 1} aria-label="Доля сданных работ" />
        <p>По занятиям, которые уже начались</p></section>
      <section className="panel"><h2>Результат</h2><strong>{max ? percent(score, max) + "%" : "—"}</strong>
        <p>{graded ? score + " из " + max + " баллов · проверено задач " + graded : "Появится после проверки преподавателем"}</p></section>
      <section className="panel"><h2>Сданы задачи</h2><strong>{submitted}<small> / {totalTasks}</small></strong>
        <p>{graded} проверено · {submitted - graded} ожидают проверки</p></section>
    </div>
    <section className="panel"><h2>Работы и сроки</h2>
      <div className="statistics-statuses">{[
        { id: "pending", label: "К сдаче", count: pending.length },
        { id: "awaiting", label: "На проверке", count: awaiting.length },
        { id: "reviewed", label: "Проверено", count: reviewed.length }
       ].map(({ id, label, count }) => <div key={id}><strong>{count}</strong><span>{label}</span></div>)}</div>
      <p className="muted">Будущие занятия добавят ещё {works.length - started.length} работ. Они не включены в показатели выше.</p>
      {overdue.length > 0 && <div className="statistics-deadlines"><h3>Срок сдачи прошёл · {overdue.length}</h3><p>Эти работы ещё можно сдать.</p>
        <ul>{overdue.map(({ assignment, kind }) => <li key={assignment.id + kind}><Link href={workPath(assignment.id, kind)}>{assignment.content.work?.[kind]?.title || assignment.content.title}</Link></li>)}</ul>
      </div>}
    </section>
    <section className="panel"><h2>Результаты по темам</h2>
      <p className="muted">Баллы учитываются только по проверенным задачам. Темы с меньшим результатом расположены первыми.</p>
      {orderedTopics.length ? <ul className="statistics-topics">{orderedTopics.map(([name, topic]) => <li key={name}>
        <div className="split"><h3>{name}</h3><b>{topic.graded ? percent(topic.score, topic.max) + "%" : "Нет оценки"}</b></div>
        {topic.graded > 0 && <progress max={topic.max} value={topic.score} aria-label={"Результат по теме «" + name + "»"} />}
        <p>Сдано {topic.submitted} из {topic.total} задач · проверено {topic.graded}{topic.graded > 0 && " · " + topic.score + " из " + topic.max + " баллов"}</p>
      </li>)}</ul> : <p className="muted">Темы появятся, когда начнутся назначенные занятия.</p>}
    </section>
    <section className="panel"><h2>Последние результаты</h2>
      <p className="muted">По дате занятия, от новых к старым. Процент рассчитан по проверенным задачам работы.</p>
      {history.length ? <ol className="statistics-history">{history.slice(0, 10).map(({ assignment, kind, state, tasks }) => {
        const checked = tasks.filter(({ index }) => assignment.grades?.[index]);
        const points = checked.reduce((sum, { index }) => sum + assignment.grades![index]!.score, 0);
        const maximum = checked.reduce((sum, { task }) => sum + task.max, 0);
        return <li key={assignment.id + kind}>
          <div><Link href={workPath(assignment.id, kind)}>{assignment.content.work?.[kind]?.title || assignment.content.title}</Link>
            <p>{date.format(assignment.starts)} · {workLabels[kind]} · {workStates[state]}</p>
            <small>Проверено {checked.length} из {tasks.length} задач</small></div>
          <div className="statistics-history-score"><b>{percent(points, maximum)}%</b><span>{points} / {maximum} б.</span></div>
        </li>;
      })}</ol> : <p className="muted">Здесь появятся работы с оценками преподавателя.</p>}
    </section>
  </CabinetFrame>;
}
