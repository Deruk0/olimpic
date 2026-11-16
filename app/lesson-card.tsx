import Link from "next/link";
import { FormattedText } from "./formatted-text";
import { formats, type Assignment, type Material, type Phase, type Submission } from "../lib/model";
import { workPath } from "../lib/paths";
import { workLabels, workTasks } from "../lib/work";

const zone = "Europe/Moscow";
const day = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: zone });
const clock = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: zone });

export function LessonMaterials({ assignment, studentView = false }: { assignment: Assignment; studentView?: boolean }) {
  const { content, settings } = assignment;
  const materials = (phase: Phase) => content.materials?.filter(material => material.phase === phase) ?? [];
  const after = materials("after");
  const starts = assignment.starts ? new Date(assignment.starts) : null;
  const theoryTitle = (assignment.kind === "diagnostic" ? "Инструкция" : "Конспект") + " «" + content.topic + "»";
  return <>
    <section className="panel lesson-section">
      <div className="controls">
        {!studentView && <span className="badge">{starts ? formats[settings.format ?? "online"] : "Без даты"}</span>}
        {starts && <time dateTime={starts.toISOString()}>{day.format(starts)} · {clock.format(starts)} МСК{!studentView && " · " + (settings.duration ?? 90) + " мин"}</time>}
        {!studentView && settings.location && <span>Место проведения · {settings.location}</span>}
      </div>
      {!studentView && <div className="controls">
        {assignment.meeting && <a className="button secondary" target="_blank" rel="noopener noreferrer" href={assignment.meeting}>Видеовстреча ↗</a>}
        {settings.recording && <a className="button secondary" target="_blank" rel="noopener noreferrer" href={settings.recording}>Запись занятия ↗</a>}
      </div>}
      <h2>{assignment.kind === "diagnostic" ? "Входная диагностика" : "Теория"}</h2>
      {content.theory && <LessonText title={theoryTitle} text={content.theory} expanded={studentView} />}
      {materials("before").map((material, i) => <LessonMaterial key={i} material={material} expanded={studentView} />)}
      {!!after.length && <><h3>Материалы после занятия</h3>{after.map((material, i) => <LessonMaterial key={i} material={material} expanded={studentView} />)}</>}
      {!content.theory && !content.materials?.length && <p className="muted">Теория к занятию не добавлена.</p>}
    </section>
    {studentView && workTasks(assignment, "homework").length > 0 && <div className="controls">
      <Link className="button" href={workPath(assignment.id, "homework")}>{workLabels.homework} →</Link>
    </div>}
  </>;
}
function LessonText({ title, text, expanded }: { title: string; text: string; expanded: boolean }) {
  const body = <FormattedText text={text} />;
  return expanded ? <section className="lesson-block"><h3>{title}</h3>{body}</section> :
    <details className="lesson-block"><summary>{title}</summary>{body}</details>;
}
function LessonMaterial({ material, expanded }: { material: Material; expanded: boolean }) {
  if (material.kind === "link") return <p className="lesson-block"><a target="_blank" rel="noopener noreferrer" href={material.value}>{material.title} ↗</a> <small>Доп. материал</small></p>;
  const label = material.kind === "definition" ? "Определение · " : material.kind === "example" ? "Разбор примера · " : "";
  return <LessonText title={label + material.title} text={material.value} expanded={expanded} />;
}
export function Files({ submission, task }: { submission: Pick<Submission, "files">; task: number }) {
  return <div className="chips">{submission.files.filter(file => file.task === task).map(file => <a key={file.id} href={"/files/" + file.id}>↓ {file.name}</a>)}</div>;
}
