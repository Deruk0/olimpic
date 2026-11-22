import Link from "next/link";
import { FormattedText } from "./formatted-text";
import type { Assignment, Material, Phase, Submission } from "../lib/model";
import { workPath } from "../lib/paths";
import { workLabels, workTasks } from "../lib/work";

const zone = "Europe/Moscow";
const day = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: zone });
const clock = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: zone });

export function LessonMaterials({ assignment }: { assignment: Assignment }) {
  const { content } = assignment;
  const materials = (phase: Phase) => content.materials?.filter(material => material.phase === phase) ?? [];
  const after = materials("after");
  const starts = new Date(assignment.starts);
  const theoryTitle = "Конспект «" + content.topic + "»";
  return <>
    <section className="panel lesson-section">
      <div className="controls">
        <time dateTime={starts.toISOString()}>{day.format(starts)} · {clock.format(starts)} МСК</time>
      </div>
      <h2>Теория</h2>
      {content.theory && <LessonText title={theoryTitle} text={content.theory} />}
      {materials("before").map((material, i) => <LessonMaterial key={i} material={material} />)}
      {!!after.length && <><h3>Материалы после занятия</h3>{after.map((material, i) => <LessonMaterial key={i} material={material} />)}</>}
      {!content.theory && !content.materials?.length && <p className="muted">Теория к занятию не добавлена.</p>}
    </section>
    {workTasks(assignment, "homework").length > 0 && <div className="controls">
      <Link className="button" href={workPath(assignment.id, "homework")}>{workLabels.homework} →</Link>
    </div>}
  </>;
}
function LessonText({ title, text }: { title: string; text: string }) {
  return <section className="lesson-block"><h3>{title}</h3><FormattedText text={text} /></section>;
}
function LessonMaterial({ material }: { material: Material }) {
  if (material.kind === "link") return <p className="lesson-block"><a target="_blank" rel="noopener noreferrer" href={material.value}>{material.title} ↗</a> <small>Доп. материал</small></p>;
  const label = material.kind === "definition" ? "Определение · " : material.kind === "example" ? "Разбор примера · " : "";
  return <LessonText title={label + material.title} text={material.value} />;
}
export function Files({ submission, task, preview = false }: { submission: Pick<Submission, "files">; task: number; preview?: boolean }) {
  const files = submission.files.filter(file => file.task === task);
  return files.length > 0 && <div className="chips">{files.map(file => <a key={file.id}
    href={"/files/" + file.id + (preview ? "?preview=1" : "")} target={preview ? "_blank" : undefined}
    rel={preview ? "noopener noreferrer" : undefined}>{preview ? "Открыть · " : "↓ "}{file.name}</a>)}</div>;
}
