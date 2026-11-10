import { TaskAnswerInputs, TaskOptionList } from "../../../../task-answer";
import Link from "next/link";
import { FormattedText } from "../../../../formatted-text";
import { notFound } from "next/navigation";
import { requireAccount } from "../../../../../lib/auth";
import type { WorkKind } from "../../../../../lib/model";
import { homeworkPath, lessonPath, workPath } from "../../../../../lib/paths";
import { preparationGoal, studentAssignment } from "../../../../../lib/student";
import { workKinds, workLabels, workState, workStates, workTasks } from "../../../../../lib/work";
import { mutate } from "../../../../actions";
import { Hidden, Submit } from "../../../../components";
import { Files } from "../../../../lesson-card";
import "./task-player.css";
import { CabinetFrame } from "../../../frame";

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
  const status = workState(tasks, assignment);
  const needsGoal = status === "pending" && !user.goal && !!await preparationGoal();
  const settings = assignment.content.work?.[kind];
  const instructions = settings?.instructions ?? (kind === "diagnostic" ? assignment.content.theory : "");
  const points = tasks.reduce((total, { index }) => total + (assignment.grades?.[index]?.score ?? 0), 0);
  const max = tasks.reduce((total, { task }) => total + task.max, 0);
  const due = kind === "homework" && settings?.dueDays !== undefined ? new Date(new Date(assignment.starts).getTime() + settings.dueDays * 86_400_000) : null;
  return <CabinetFrame user={user} view="homework" title={workLabels[kind]} saved={query.saved} error={query.error}>
    <p className="controls"><Link href={homeworkPath(id)}>← Работы занятия</Link><Link href={lessonPath(id)}>К занятию →</Link></p>
    <section className="panel">
      <div className="split"><h2>{assignment.content.title}</h2><span className="badge">{workStates[status]}</span></div>
      {settings?.title && <h3>{settings.title}</h3>}
      <FormattedText text={instructions} />
      {due && <p className="muted">Срок сдачи · {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Moscow" }).format(due)} МСК
        {status === "pending" && due.getTime() < Date.now() && " · срок прошёл, работу ещё можно сдать"}</p>}
      {kind === "assessment" && <div className="chips">
        {settings?.minutes !== undefined && <span>Рекомендуемое время · {settings.minutes} мин</span>}
        {settings?.pass !== undefined && <span>Порог · {settings.pass}%</span>}
      </div>}
      {status === "reviewed" && <p className="notice"><b>{points} / {max} баллов</b>
        {kind === "assessment" && settings?.pass !== undefined && " · " + (100 * points / max >= settings.pass ? "Порог пройден" : "Порог не пройден")}
      </p>}
      {needsGoal && <p><Link href="/cabinet/schedule#goal">Подтвердите цель подготовки</Link>, чтобы сдать работу.</p>}
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
      <form action={mutate} className="editor">
        <Hidden name="action" value="submit" /><Hidden name="return" value="homework" /><Hidden name="assignment" value={id} /><Hidden name="kind" value={kind} />
        <Hidden name="revision" value={assignment.revision} /><Hidden name="task" value={active.index} />
        {[active].map(({ task, index }) => <fieldset key={index} id={"task-" + index} className="lesson-task">
          <legend>{activePosition + 1}. {task.title} · {task.max} б.</legend><FormattedText text={task.prompt} />
          {kind === "practice" && task.hint && <details><summary>Подсказка</summary><FormattedText text={task.hint} /></details>}
          {kind === "practice" && task.solution && <details><summary>Разбор для самопроверки</summary><FormattedText text={task.solution} /></details>}
          {activeStatus !== "pending" ? <>{activeStatus === "awaiting" && <p className="notice">Ответ отправлен и ожидает проверки куратора.</p>}<Files submission={assignment} task={index} />
            {typeof assignment.answers?.[index] === "string" && <p className="pre">{assignment.answers[index]}</p>}
            {Array.isArray(assignment.answers?.[index]) && <TaskOptionList task={task} indexes={assignment.answers[index] as number[]} />}
            {assignment.grades?.[index] && <div className="notice pre"><b>{assignment.grades[index].score} / {task.max}</b><br />{assignment.grades[index].comment}</div>}</> :
            !needsGoal && <TaskAnswerInputs task={task} index={index} />}
        </fieldset>)}
        {activeStatus === "pending" && !needsGoal && <>{(!active.task.response || active.task.response === "file") && <small className="muted">PDF, JPEG или PNG. До 3 файлов на задачу, 6 МБ на файл и 24 МБ на работу.</small>}<Submit>Отправить ответ</Submit></>}
      </form>
      <div className="task-page-controls">
        {activePosition > 0 && <Link className="button secondary" prefetch={false} href={workPath(id, kind) + "?task=" + tasks[activePosition - 1].index}>← Предыдущее</Link>}
        <span>Задание {activePosition + 1} из {tasks.length}</span>
        {activePosition + 1 < tasks.length && <Link className="button secondary" prefetch={false} href={workPath(id, kind) + "?task=" + tasks[activePosition + 1].index}>Следующее →</Link>}
      </div>
    </section>
  </CabinetFrame>;
}
