import { TaskAnswerInputs, TaskOptionList } from "../../../../task-answer";
import { ScrollArea } from "../../../../scroll-area";
import Link from "next/link";
import { FormattedText } from "../../../../formatted-text";
import { notFound } from "next/navigation";
import { requireAccount } from "../../../../../lib/auth";
import { formatLessonTime } from "../../../../../lib/lesson-time";
import type { WorkKind } from "../../../../../lib/model";
import { homeworkPath, lessonPath, workPath } from "../../../../../lib/paths";
import { studentAssignment } from "../../../../../lib/student";
import { workDeadline, workKinds, workScore, workState, workStatus, workTasks, workTitle } from "../../../../../lib/work";
import { submitWork } from "../../../../actions";
import { Hidden, Submit } from "../../../../components";
import { Files } from "../../../../lesson-card";
import "./task-player.css";
import { CabinetFrame } from "../../../frame";
import { WorkBadge } from "../../../work-badge";
import { WorkFileInput } from "./work-file-input";

export default async function WorkPage({ params, searchParams }: {
  params: Promise<{ id: string; kind: string }>; searchParams: Promise<{ saved?: string; error?: string; task?: string }>;
}) {
  const user = await requireAccount("student");
  const { id, kind: value } = await params;
  const kind = value as WorkKind;
  if (!workKinds.includes(kind)) notFound();
  const assignment = await studentAssignment(user.id, id);
  if (!assignment) notFound();
  const tasks = workTasks(assignment, kind);
  if (!tasks.length) notFound();
  const query = await searchParams;
  const active = tasks.find(({ index }) => String(index) === query.task) ?? tasks[0];
  const activeStatus = workState([active], assignment);
  const activePosition = tasks.findIndex(({ index }) => index === active.index);
  const due = workDeadline(assignment, kind);
  const status = workStatus(tasks, assignment, due);
  const settings = assignment.content.work?.[kind];
  const instructions = settings?.instructions ?? "";
  const { score, total, graded } = workScore(tasks, assignment);
  const lesson = assignment.lesson_id ?? (assignment.entry_kind === "lesson" ? id : null);
  const { task, index } = active;
  const sendsFile = !task.response || task.response === "file";
  const answered = tasks.filter(entry => workState([entry], assignment) !== "pending").length;
  return <CabinetFrame user={user} view="homework" title={workTitle(assignment, kind)}
    back={{ href: "/cabinet/homework", label: "Домашние задания" }} saved={query.saved} error={query.error}>
    <div className="work-context">
      <p className="muted">{assignment.teacher_name}{assignment.lesson_title && " · " + assignment.lesson_title}
        {due && <> · До <time dateTime={due.toISOString()}>{formatLessonTime(due)}</time></>}</p>
      <div className="controls"><WorkBadge state={status} /><span className="muted">{answered} из {tasks.length} с ответами</span></div>
    </div>
    <p className="controls work-links">
      {lesson && <><Link href={homeworkPath(lesson)}>Работы занятия</Link><Link href={lessonPath(lesson)}>К занятию →</Link></>}
    </p>
    <section className="work-player" aria-label="Задания работы">
      <FormattedText text={instructions} />
      {status === "overdue" && <p className="muted">Срок сдачи прошёл. Работу ещё можно сдать.</p>}
      {kind === "assessment" && <div className="chips">
        {settings?.minutes !== undefined && <span>Рекомендуемое время · {settings.minutes} мин</span>}
        {settings?.pass !== undefined && <span>Порог · {settings.pass}%</span>}
      </div>}
      <ScrollArea label="Номера заданий" role="navigation" axis="horizontal" className="task-number-nav" contentClassName="task-number-list">
        {tasks.map(({ task, index }, position) => {
          const grade = assignment.grades?.[index];
          const sent = workState([{ task, index }], assignment) !== "pending";
          const state = grade ? (grade.score === task.max ? "correct" : "incorrect") : sent ? "awaiting" : "empty";
          const label = grade ? (grade.score === task.max ? "Верно" : "Есть ошибки") : sent ? "На проверке" : "Не выполнено";
          return <Link key={index} prefetch={false} scroll={false} href={workPath(id, kind) + "?task=" + index}
            className={"task-number is-" + state} aria-current={active.index === index ? "step" : undefined}
            aria-label={"Задание " + (position + 1) + " · " + label} title={label}>
            {position + 1}{state !== "empty" && <span aria-hidden="true">{{ correct: "✓", incorrect: "!", awaiting: "…" }[state]}</span>}
          </Link>;
        })}
      </ScrollArea>
      <div className="task-page-controls">
        {activePosition > 0 && <Link className="button secondary task-page-previous" prefetch={false} scroll={false} href={workPath(id, kind) + "?task=" + tasks[activePosition - 1].index}>← Предыдущее</Link>}
        <span className="task-page-position">Задание {activePosition + 1} из {tasks.length}</span>
        {activePosition + 1 < tasks.length && <Link className="button secondary task-page-next" prefetch={false} scroll={false} href={workPath(id, kind) + "?task=" + tasks[activePosition + 1].index}>Следующее →</Link>}
      </div>
      <form action={submitWork} className="editor work-surface" key={index}>
        <Hidden name="assignment" value={id} /><Hidden name="kind" value={kind} />
        <Hidden name="revision" value={assignment.revision} /><Hidden name="task" value={index} />
        <section id={"task-" + index} className="work-prompt" aria-labelledby="work-task-title">
          <h2 id="work-task-title">{activePosition + 1}. {task.title}</h2>
          <p className="muted">{task.max} б.</p>
          <FormattedText text={task.prompt} />
          {kind === "practice" && task.hint && <details><summary>Подсказка</summary><FormattedText text={task.hint} /></details>}
          {kind === "practice" && task.solution && <details><summary>Разбор для самопроверки</summary><FormattedText text={task.solution} /></details>}
        </section>
        <section className="work-response" aria-labelledby="work-response-title">
          <h2 id="work-response-title">Ваш ответ</h2>
          {activeStatus !== "pending" ? <>{activeStatus === "awaiting" && <p className="notice">Ответ отправлен и ожидает проверки преподавателя.</p>}<Files submission={assignment} task={index} />
            {typeof assignment.answers?.[index] === "string" && <p className="pre">{assignment.answers[index]}</p>}
            {Array.isArray(assignment.answers?.[index]) && <TaskOptionList task={task} indexes={assignment.answers[index] as number[]} />}
            {assignment.grades?.[index] && <div className="notice pre"><b>{assignment.grades[index].score} / {task.max}</b><br />{assignment.grades[index].comment}</div>}</> :
            <>{sendsFile ? <WorkFileInput index={index} /> : <TaskAnswerInputs task={task} index={index} />}
              <Submit>Отправить ответ</Submit></>}
        </section>
      </form>
      {!!graded.length && <p className="work-score muted"><b>{score} / {total} баллов за работу</b>
        {graded.length < tasks.length && " · Проверено " + graded.length + " из " + tasks.length}
        {status === "reviewed" && kind === "assessment" && settings?.pass !== undefined && " · " + (100 * score / total >= settings.pass ? "Порог пройден" : "Порог не пройден")}
      </p>}
    </section>
  </CabinetFrame>;
}
