import Link from "next/link";
import { notFound } from "next/navigation";
import { hasAutomaticGrade } from "../../../../../lib/answers";
import { requireAccount } from "../../../../../lib/auth";
import { formatLessonTime } from "../../../../../lib/lesson-time";
import type { WorkKind } from "../../../../../lib/model";
import { reviewPath } from "../../../../../lib/paths";
import { teacherAssignment } from "../../../../../lib/teacher";
import { workDeadline, workKinds, workScore, workState, workStatus, workTasks, workTitle } from "../../../../../lib/work";
import { Submit } from "../../../../components";
import { FormattedText } from "../../../../formatted-text";
import { InterfaceIcon } from "../../../../interface-icons";
import { TaskOptionList } from "../../../../task-answer";
import { CabinetFrame } from "../../../frame";
import { gradeTask } from "../../../teacher-actions";
import { WorkBadge } from "../../../work-badge";
import "./review-work.css";

export default async function ReviewWork({ params, searchParams }: {
  params: Promise<{ id: string; kind: string }>; searchParams: Promise<{ saved?: string; issued?: string; error?: string; task?: string }>;
}) {
  const teacher = await requireAccount("teacher");
  const { id, kind: value } = await params;
  const kind = value as WorkKind;
  if (!workKinds.includes(kind)) notFound();
  const assignment = await teacherAssignment(teacher.id, id);
  if (!assignment) notFound();
  const tasks = workTasks(assignment, kind);
  if (!tasks.length) notFound();
  const query = await searchParams;
  const deadline = workDeadline(assignment, kind);
  const state = workStatus(tasks, assignment, deadline);
  const score = workScore(tasks, assignment);
  const entries = tasks.map(({ task, index }, position) => ({
    task, index, position,
    grade: assignment.grades?.[index],
    automatic: hasAutomaticGrade(task),
    sent: workState([{ task, index }], assignment) !== "pending",
  }));
  const active = entries.find(entry => String(entry.index) === query.task) ??
    entries.find(entry => entry.sent && !entry.automatic && !entry.grade) ?? entries[0];
  const { task, index, position, grade, automatic, sent } = active;
  const answer = assignment.answers?.[index];
  const files = assignment.files.filter(file => file.task === index);
  const canGrade = !automatic && sent && state !== "pending" && state !== "overdue";
  const autoGraded = entries.filter(entry => entry.automatic && entry.grade);
  return <CabinetFrame user={teacher} view="review" title={workTitle(assignment, kind)}
    back={{ href: "/cabinet/review", label: "Проверка работ" }} saved={query.saved} error={query.error}>
    {query.issued === "1" && <p className="notice" role="status">Домашнее задание выдано.</p>}
    <div className="review-context">
      <span className="section-title"><InterfaceIcon name="profile" />{assignment.student_name}</span>
      <WorkBadge state={state} />
      {assignment.lesson_title && <span className="muted">{assignment.lesson_title}</span>}
      {deadline && <span className="muted">До <time dateTime={deadline.toISOString()}>{formatLessonTime(deadline)}</time></span>}
      {!!score.graded.length && <span className="muted"><b>{score.score} из {score.total} б.</b> · проверено {score.graded.length} из {tasks.length}</span>}
    </div>
    <div className="review-workspace">
      <nav className="review-task-nav" aria-label="Задания для проверки">
        <h2>Задания</h2>
        {entries.map(entry => <Link key={entry.index} scroll={false} href={reviewPath(id, kind) + "?task=" + entry.index}
          aria-current={entry.index === index ? "step" : undefined}>
          <strong>Задание {entry.position + 1}</strong>
          <small>{entry.grade ? entry.grade.score + " из " + entry.task.max : entry.sent ? "На проверке" : "Ответа нет"}</small>
        </Link>)}
        {autoGraded.length > 0 && <p className="muted">Автопроверка · {autoGraded.reduce((sum, entry) => sum + (entry.grade?.score ?? 0), 0)} из {autoGraded.reduce((sum, entry) => sum + entry.task.max, 0)} б.</p>}
      </nav>
      <section className="review-submission" id={"task-" + index} aria-labelledby="review-answer-title">
        <h2 id="review-answer-title">Ответ ученика</h2>
        {!sent && <p className="muted">Ответа пока нет.</p>}
        {Array.isArray(answer) ? <TaskOptionList task={task} indexes={answer} /> : answer && <p className="pre">{answer}</p>}
        {files.map(file => {
          const url = "/files/" + encodeURIComponent(file.id) + "?preview=1";
          return <figure className="review-file" key={file.id}>
            <figcaption><InterfaceIcon name="image" /><a href={url} target="_blank" rel="noreferrer">{file.name} ↗</a></figcaption>
            {/\.(jpe?g|png)$/i.test(file.name) && <a className="review-file-photo" href={url} target="_blank" rel="noreferrer" aria-label={"Открыть фото · " + file.name}><img src={url} alt={"Решение ученика · " + file.name} /></a>}
          </figure>;
        })}
        <details className="review-task-context">
          <summary>{position + 1}. {task.title} · условие</summary>
          <FormattedText text={task.prompt} />
        </details>
        {task.rubric && <details className="review-task-context"><summary>Критерии проверки</summary><FormattedText text={task.rubric} /></details>}
        {task.modelAnswer && <details className="review-task-context"><summary>Образец решения</summary><FormattedText text={task.modelAnswer} /></details>}
      </section>
      <section className="review-grade" aria-labelledby="review-grade-title">
        <h2 id="review-grade-title">Оценка</h2>
        {grade && <p className="notice pre"><b>{grade.score} / {task.max} б.{automatic && " · Автопроверка"}</b>
          {grade.comment && <><br />{grade.comment}</>}</p>}
        {canGrade && <form className="editor" action={gradeTask.bind(null, id, kind, index)} key={index}>
          <label>Баллы из {task.max}<input name="score" type="number" required min={0} max={task.max} defaultValue={grade?.score} /></label>
          <label>Комментарий ученику<textarea name="comment" rows={4} maxLength={3000} defaultValue={grade?.comment} /></label>
          <Submit>Сохранить оценку</Submit>
        </form>}
        {!canGrade && !grade && <p className="muted">{automatic ? "Баллы выставляются автоматически." : "Оценка доступна после сдачи всей работы."}</p>}
      </section>
    </div>
  </CabinetFrame>;
}
