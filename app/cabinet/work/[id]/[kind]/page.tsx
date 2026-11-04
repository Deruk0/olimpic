import Link from "next/link";
import { FormattedText } from "../../../../formatted-text";
import { notFound } from "next/navigation";
import { requireAccount } from "../../../../../lib/auth";
import type { WorkKind } from "../../../../../lib/model";
import { homeworkPath, lessonPath } from "../../../../../lib/paths";
import { studentAssignment } from "../../../../../lib/student";
import { workKinds, workLabels, workState, workStates, workTasks } from "../../../../../lib/work";
import { mutate } from "../../../../actions";
import { Hidden, Submit } from "../../../../components";
import { Files } from "../../../../lesson-card";
import { CabinetFrame } from "../../../frame";

export default async function WorkPage({ params, searchParams }: {
  params: Promise<{ id: string; kind: string }>; searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requireAccount("student");
  const { id, kind: value } = await params;
  const kind = value as WorkKind;
  if (!workKinds.includes(kind)) notFound();
  const assignment = await studentAssignment(user.id, id);
  if (!assignment) notFound();
  const tasks = workTasks(assignment, kind);
  if (!tasks.length) notFound();
  const status = workState(tasks, assignment);
  const settings = assignment.content.work?.[kind];
  const instructions = settings?.instructions ?? (kind === "diagnostic" ? assignment.content.theory : "");
  const points = tasks.reduce((total, { index }) => total + (assignment.grades?.[index]?.score ?? 0), 0);
  const max = tasks.reduce((total, { task }) => total + task.max, 0);
  const due = kind === "homework" && settings?.dueDays !== undefined ? new Date(new Date(assignment.starts).getTime() + settings.dueDays * 86_400_000) : null;
  return <CabinetFrame user={user} view="homework" title={workLabels[kind]} {...await searchParams}>
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
      {!user.goal && status === "pending" && <p><Link href="/cabinet?view=learn#goal">Подтвердите цель подготовки</Link>, чтобы сдать работу.</p>}
      <form action={mutate} className="editor">
        <Hidden name="action" value="submit" /><Hidden name="return" value="homework" /><Hidden name="assignment" value={id} /><Hidden name="kind" value={kind} />
        <Hidden name="revision" value={assignment.revision} />
        {tasks.map(({ task, index }, position) => <fieldset key={index} className="lesson-task">
          <legend>{position + 1}. {task.title} · {task.max} б.</legend><FormattedText text={task.prompt} />
          {kind === "practice" && task.hint && <details><summary>Подсказка</summary><FormattedText text={task.hint} /></details>}
          {kind === "practice" && task.solution && <details><summary>Разбор для самопроверки</summary><FormattedText text={task.solution} /></details>}
          {status !== "pending" ? <><Files submission={assignment} task={index} />
            {typeof assignment.answers?.[index] === "string" && <p className="pre">{assignment.answers[index]}</p>}
            {Array.isArray(assignment.answers?.[index]) && <ul>{(assignment.answers[index] as number[]).map(option => <li key={option}>{task.options?.[option]}</li>)}</ul>}
            {assignment.grades?.[index] && <div className="notice pre"><b>{assignment.grades[index].score} / {task.max}</b><br />{assignment.grades[index].comment}</div>}</> :
            user.goal && (task.response === "text" ? <label>Ваш ответ<textarea name={"answer." + index} rows={6} maxLength={12000} required /></label> :
              task.response === "single" || task.response === "multiple" ? <div className="answer-options">
                <small>{task.response === "single" ? "Выберите один вариант" : "Выберите все подходящие варианты"}</small>
                {task.options?.map((option, i) => <label key={i}><input name={"answer." + index} type={task.response === "single" ? "radio" : "checkbox"} value={i} required={task.response === "single"} />{option}</label>)}
              </div> : <label>Решение задания «{task.title}»<input name={"file." + index} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple required /></label>)}
        </fieldset>)}
        {status === "pending" && user.goal && <>{tasks.some(({ task }) => !task.response || task.response === "file") && <small className="muted">PDF, JPEG или PNG. До 3 файлов на задачу, 6 МБ на файл и 24 МБ на работу.</small>}<Submit>Сдать работу</Submit></>}
      </form>
    </section>
  </CabinetFrame>;
}
