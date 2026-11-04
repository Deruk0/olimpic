import Link from "next/link";
import { FormattedText } from "./formatted-text";
import { formats, levels, type Assignment, type Material, type Phase, type Submission } from "../lib/model";
import { lessonPath, workPath } from "../lib/paths";
import { workKinds, workLabels, workState, workStates, workTasks } from "../lib/work";

const zone = "Europe/Moscow";
const day = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: zone });
const clock = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: zone });

export function StudentLesson({ assignment, submission, attended, expanded, index }: {
  assignment: Assignment; submission?: Submission; attended: boolean; expanded: boolean; index: number;
}) {
  const { content, settings } = assignment;
  const start = new Date(assignment.starts);
  const end = new Date(start.getTime() + (settings.duration ?? 90) * 60_000);
  const homework = workTasks(assignment, "homework");
  const percent = workState(homework, submission) === "reviewed" ? 100 : 0;
  const topics = [...new Set([content.topic, ...content.tasks.map(task => task.topic)])];
  return <article className="lesson-card" id={"work-" + assignment.id}>
    <details className="lesson-fold" open={expanded}>
      <summary className="lesson-summary">
        <div className="lesson-main">
          <div className="lesson-date">▦ {day.format(start)} <span>· {assignment.kind === "diagnostic" ? "Диагностика" : "Занятие " + index + " · " + levels[assignment.level]}</span></div>
          <div className="lesson-title"><h2>{content.title}</h2>{attended && <span className="lesson-done">✓ Посещено</span>}</div>
          <div className="lesson-meta"><span>{formats[settings.format ?? "online"]}</span><span>{clock.format(start)}–{clock.format(end)} МСК</span></div>
          {homework.length > 0 && <div className="lesson-progress"><div><span>Прогресс по ДЗ</span><b>{percent}%</b></div><progress max={100} value={percent} aria-label="Прогресс по домашним заданиям" /></div>}
          <p className="lesson-topics"><b>Темы занятия</b> {topics.join(" · ")}</p>
        </div>
        <span className="lesson-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="lesson-body">
        <div className="controls lesson-links">
          <Link className="button" href={lessonPath(assignment.id)}>Открыть занятие</Link>
          {workKinds.map(kind => {
            const tasks = workTasks(assignment, kind);
            return tasks.length > 0 && <Link key={kind} className="button secondary" href={workPath(assignment.id, kind)}>{workLabels[kind]} · {workStates[workState(tasks, submission)]}</Link>;
          })}
        </div>
      </div>
    </details>
  </article>;
}

export function LessonMaterials({ assignment, showWorks = true }: { assignment: Assignment; showWorks?: boolean }) {
  const { content, settings } = assignment;
  const materials = (phase: Phase) => content.materials?.filter(material => material.phase === phase) ?? [];
  const after = materials("after");
  return <>
    <section className="panel lesson-section">
      <div className="controls">
        <span className="badge">{formats[settings.format ?? "online"]}</span>
        <span>{day.format(new Date(assignment.starts))} · {clock.format(new Date(assignment.starts))} МСК · {settings.duration ?? 90} мин</span>
        {settings.location && <span>Место проведения · {settings.location}</span>}
      </div>
      <div className="controls">
        {assignment.meeting && <a className="button secondary" target="_blank" rel="noopener noreferrer" href={assignment.meeting}>Видеовстреча ↗</a>}
        {settings.recording && <a className="button secondary" target="_blank" rel="noopener noreferrer" href={settings.recording}>Запись занятия ↗</a>}
      </div>
      <h2>{assignment.kind === "diagnostic" ? "Входная диагностика" : "Теория"}</h2>
      {content.theory && <details className="lesson-block"><summary>{assignment.kind === "diagnostic" ? "Инструкция" : "Конспект"} «{content.topic}»</summary><FormattedText text={content.theory} /></details>}
      {materials("before").map((material, i) => <LessonMaterial key={i} material={material} />)}
      {!!after.length && <><h3>Материалы после занятия</h3>{after.map((material, i) => <LessonMaterial key={i} material={material} />)}</>}
      {!content.theory && !content.materials?.length && <p className="muted">Теория к занятию не добавлена.</p>}
    </section>
    {showWorks && <section className="panel lesson-section">
      <h2>Работы занятия</h2>
      <div className="controls">{workKinds.filter(kind => workTasks(assignment, kind).length).map(kind =>
        <Link key={kind} className="button" href={workPath(assignment.id, kind)}>{workLabels[kind]} →</Link>)}</div>
    </section>}
  </>;
}
function LessonMaterial({ material }: { material: Material }) {
  if (material.kind === "link") return <p className="lesson-block"><a target="_blank" rel="noopener noreferrer" href={material.value}>{material.title} ↗</a> <small>Доп. материал</small></p>;
  const label = material.kind === "definition" ? "Определение · " : material.kind === "example" ? "Разбор примера · " : "";
  return <details className="lesson-block"><summary>{label}{material.title}</summary><FormattedText text={material.value} /></details>;
}
export function Files({ submission, task }: { submission: Pick<Submission, "files">; task: number }) {
  return <div className="chips">{submission.files.filter(file => file.task === task).map(file => <a key={file.id} href={"/files/" + file.id}>↓ {file.name}</a>)}</div>;
}
