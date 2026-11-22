import { TaskAnswerInputs, TaskOptionList } from "../../../../task-answer";
import Link from "next/link";
import { FormattedText } from "../../../../formatted-text";
import { notFound } from "next/navigation";
import { requireAccount } from "../../../../../lib/auth";
import { formatLessonTime } from "../../../../../lib/lesson-time";
import type { WorkKind } from "../../../../../lib/model";
import { homeworkPath, lessonPath, workPath } from "../../../../../lib/paths";
import { studentAssignment } from "../../../../../lib/student";
import { workDeadline, workKinds, workLabels, workScore, workState, workStatus, workTasks, workTitle } from "../../../../../lib/work";
import { submitWork } from "../../../../actions";
import { Hidden, Submit } from "../../../../components";
import { Files } from "../../../../lesson-card";
import "./task-player.css";
import { CabinetFrame } from "../../../frame";
import { WorkBadge } from "../../../work-badge";

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
  return <CabinetFrame user={user} view="homework" title={workLabels[kind]} saved={query.saved} error={query.error}>
    <p className="controls"><Link href="/cabinet/homework">← Все задания</Link>
      {lesson && <><Link href={homeworkPath(lesson)}>Работы занятия</Link><Link href={lessonPath(lesson)}>К занятию →</Link></>}
    </p>
    <section className="panel">
      <div className="split"><h2>{workTitle(assignment, kind)}</h2><WorkBadge state={status} /></div>
      <p className="muted">{assignment.teacher_name}{assignment.lesson_title && " · " + assignment.lesson_title}</p>
      <FormattedText text={instructions} />
      {due && <p>Сдать до <time dateTime={due.toISOString()}>{formatLessonTime(due)}</time>
        {status === "overdue" && " · работу ещё можно сдать"}</p>}
      {kind === "assessment" && <div className="chips">
        {settings?.minutes !== undefined && <span>Рекомендуемое время · {settings.minutes} мин</span>}
        {settings?.pass !== undefined && <span>Порог · {settings.pass}%</span>}
      </div>}
      {!!graded.length && <p className="notice"><b>{score} / {total} баллов</b>
        {graded.length < tasks.length && " · Проверено " + graded.length + " из " + tasks.length}
        {status === "reviewed" && kind === "assessment" && settings?.pass !== undefined && " · " + (100 * score / total >= settings.pass ? "Порог пройден" : "Порог не пройден")}
      </p>}
      <nav className="task-number-nav" aria-label="Номера заданий">
        {tasks.map(({ task, index }, position) => {
          const grade = assignment.grades?.[index];
          const sent = workState([{ task, index }], assignment) !== "pending";
          const state = grade ? (grade.score === task.max ? "correct" : "incorrect") : sent ? "awaiting" : "empty";
          const label = grade ? (grade.score === task.max ? "Верно" : "Есть ошибки") : sent ? "На проверке" : "Не выполнено";
          return <Link key={index} prefetch={false} href={workPath(id, kind) + "?task=" + index}
            className={"task-number is-" + state} aria-current={active.index === index ? "step" : undefined}
            aria-label={"Задание " + (position + 1) + " · " + label} title={label}>{position + 1}</Link>;
        })}
      </nav>
      <form action={submitWork} className="editor">
        <Hidden name="assignment" value={id} /><Hidden name="kind" value={kind} />
        <Hidden name="revision" value={assignment.revision} /><Hidden name="task" value={active.index} />
        {[active].map(({ task, index }) => <fieldset key={index} id={"task-" + index} className="lesson-task">
          <legend>{activePosition + 1}. {task.title} · {task.max} б.</legend><FormattedText text={task.prompt} />
          {kind === "practice" && task.hint && <details><summary>Подсказка</summary><FormattedText text={task.hint} /></details>}
          {kind === "practice" && task.solution && <details><summary>Разбор для самопроверки</summary><FormattedText text={task.solution} /></details>}
          {activeStatus !== "pending" ? <>{activeStatus === "awaiting" && <p className="notice">Ответ отправлен и ожидает проверки преподавателя.</p>}<Files submission={assignment} task={index} />
            {typeof assignment.answers?.[index] === "string" && <p className="pre">{assignment.answers[index]}</p>}
            {Array.isArray(assignment.answers?.[index]) && <TaskOptionList task={task} indexes={assignment.answers[index] as number[]} />}
            {assignment.grades?.[index] && <div className="notice pre"><b>{assignment.grades[index].score} / {task.max}</b><br />{assignment.grades[index].comment}</div>}</> :
            <TaskAnswerInputs task={task} index={index} />}
        </fieldset>)}
        {activeStatus === "pending" && <>{(!active.task.response || active.task.response === "file") && <small className="muted">PDF, JPEG или PNG. До 3 файлов на задачу, 6 МБ на файл и 24 МБ на работу.</small>}<Submit>Отправить ответ</Submit></>}
      </form>
      <div className="task-page-controls">
        {activePosition > 0 && <Link className="button secondary" prefetch={false} href={workPath(id, kind) + "?task=" + tasks[activePosition - 1].index}>← Предыдущее</Link>}
        <span>Задание {activePosition + 1} из {tasks.length}</span>
        {activePosition + 1 < tasks.length && <Link className="button secondary" prefetch={false} href={workPath(id, kind) + "?task=" + tasks[activePosition + 1].index}>Следующее →</Link>}
      </div>
    </section>
  </CabinetFrame>;
}
