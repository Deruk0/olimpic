import Link from "next/link";
import { requireAccount } from "../../../lib/auth";
import { lessonPath, workPath } from "../../../lib/paths";
import { studentAssignments, studentWorks } from "../../../lib/student";
import { CabinetFrame } from "../frame";

const date = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Moscow" });

export default async function CoursePage() {
  const user = await requireAccount("student");
  const assignments = await studentAssignments(user.id);
  const works = studentWorks(assignments);
  const pending = works.filter(work => work.state === "pending");
  const awaiting = works.filter(work => work.state === "awaiting");
  const reviewed = works.filter(work => work.state === "reviewed");
  const now = Date.now();
  const nextLesson = assignments.find(work => new Date(work.starts).getTime() >= now);
  const latestRecording = assignments.filter(work => new Date(work.starts).getTime() < now && work.settings.recording).at(-1);
  const nextWork = pending.find(work => work.kind === "diagnostic" && new Date(work.assignment.starts).getTime() <= now)
    ?? pending.find(work => new Date(work.assignment.starts).getTime() <= now);
  const topics = new Map<string, { score: number; max: number; count: number }>();
  for (const work of reviewed) {
    work.tasks.forEach(({ task, index }) => {
      const grade = work.assignment.grades?.[index];
      if (!grade) return;
      const entry = topics.get(task.topic) ?? { score: 0, max: 0, count: 0 };
      entry.score += grade.score;
      entry.max += task.max;
      entry.count++;
      topics.set(task.topic, entry);
    });
  }
  return <CabinetFrame user={user} view="course" title="Прогресс курса">
    <section className="panel course-intro">
      <p className="eyebrow">Олимпиадная математика</p>
      <h2>{user.goal || "Подготовка к олимпиаде"}</h2>
      <p className="muted">{assignments[0]?.group_name ?? "Расписание появится после назначения занятий куратором."}</p>
      <div className="controls">
        {!user.goal ? <Link className="button" href="/cabinet?view=learn">Указать цель подготовки</Link> :
          nextWork ? <Link className="button" href={workPath(nextWork.assignment.id, nextWork.kind)}>{nextWork.kind === "diagnostic" ? "Пройти диагностику" : "Продолжить работу"} →</Link> :
          nextLesson ? <Link className="button" href={lessonPath(nextLesson.id)}>Открыть ближайшее занятие →</Link> : null}
        <Link className="button secondary" href="/cabinet?view=learn">Расписание</Link>
        <Link className="button secondary" href="/cabinet?view=plan">Траектория</Link>
      </div>
    </section>
    <div className="course-grid">
      <section className="panel">
        <h2>Ближайшее занятие</h2>
        {nextLesson ? <><p>{date.format(new Date(nextLesson.starts))} МСК</p><Link href={lessonPath(nextLesson.id)}>{nextLesson.content.title} →</Link></> :
          <p className="muted">Ближайших занятий пока нет.</p>}
        {latestRecording && <p><Link href={lessonPath(latestRecording.id)}>Последняя запись · {latestRecording.content.title}</Link></p>}
      </section>
      <section className="panel">
        <h2>Учебные работы</h2>
        <div className="chips">
          <Link href="/cabinet/homework?status=pending">К сдаче · {pending.length}</Link>
          <Link href="/cabinet/homework?status=awaiting">На проверке · {awaiting.length}</Link>
          <Link href="/cabinet/homework?status=reviewed">Проверено · {reviewed.length}</Link>
        </div>
      </section>
    </div>
    <section className="panel">
      <h2>Результаты по темам</h2>
      {topics.size ? <ul className="topic-results">{[...topics].map(([topic, result]) =>
        <li key={topic} className="split"><b>{topic}</b><span>{result.score} из {result.max} баллов · проверено задач: {result.count}</span></li>
      )}</ul> : <p className="muted">Здесь появятся баллы после проверки решений куратором.</p>}
    </section>
  </CabinetFrame>;
}
