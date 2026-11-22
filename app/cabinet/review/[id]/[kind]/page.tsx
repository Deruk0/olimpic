import Link from "next/link";
import { notFound } from "next/navigation";
import { hasAutomaticGrade } from "../../../../../lib/answers";
import { requireAccount } from "../../../../../lib/auth";
import { formatLessonTime } from "../../../../../lib/lesson-time";
import type { WorkKind } from "../../../../../lib/model";
import { teacherAssignment } from "../../../../../lib/teacher";
import { workDeadline, workKinds, workScore, workState, workStatus, workTasks, workTitle } from "../../../../../lib/work";
import { Submit } from "../../../../components";
import { FormattedText } from "../../../../formatted-text";
import { Files } from "../../../../lesson-card";
import { TaskOptionList } from "../../../../task-answer";
import { CabinetFrame } from "../../../frame";
import { gradeTask } from "../../../teacher-actions";
import { WorkBadge } from "../../../work-badge";

export default async function ReviewWork({ params, searchParams }: {
  params: Promise<{ id: string; kind: string }>; searchParams: Promise<{ saved?: string; issued?: string; error?: string }>;
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
  return <CabinetFrame user={teacher} view="review" title={workTitle(assignment, kind)} saved={query.saved} error={query.error}>
    <p><Link href="/cabinet/review">← К проверке работ</Link></p>
    {query.issued === "1" && <p className="notice" role="status">Домашнее задание выдано.</p>}
    <section className="panel">
      <div className="split"><h2>{assignment.student_name}</h2><WorkBadge state={state} /></div>
      {assignment.lesson_title && <p>Урок · {assignment.lesson_title}</p>}
      {deadline && <p>Сдать до <time dateTime={deadline.toISOString()}>{formatLessonTime(deadline)}</time></p>}
      {!!score.graded.length && <p><b>{score.score} / {score.total} б.</b> · Проверено {score.graded.length} из {tasks.length}</p>}
    </section>
    {tasks.map(({ task, index }, position) => {
      const answer = assignment.answers?.[index];
      const grade = assignment.grades?.[index];
      const automatic = hasAutomaticGrade(task);
      const sent = workState([{ task, index }], assignment) !== "pending";
      const canGrade = !automatic && sent && state !== "pending" && state !== "overdue";
      return <section className="panel" id={"task-" + index} key={index}>
        <div className="split"><h2>{position + 1}. {task.title}</h2><span className="badge">{task.max} б.</span></div>
        <FormattedText text={task.prompt} />
        {task.rubric && <details><summary>Критерии проверки</summary><FormattedText text={task.rubric} /></details>}
        {task.modelAnswer && <details><summary>Образец решения</summary><FormattedText text={task.modelAnswer} /></details>}
        {sent ? <><h3>Ответ ученика</h3>
          {Array.isArray(answer) ? <TaskOptionList task={task} indexes={answer} /> : answer && <p className="pre">{answer}</p>}
          <Files submission={assignment} task={index} preview />
        </> : <p className="muted">Ответа пока нет.</p>}
        {grade && <p className="notice pre"><b>{grade.score} / {task.max} б.{automatic && " · Автопроверка"}</b>
          {grade.comment && <><br />{grade.comment}</>}</p>}
        {canGrade && <form className="editor" action={gradeTask.bind(null, id, kind, index)}>
          <div className="formgrid"><label>Баллы<input name="score" type="number" required min={0} max={task.max} defaultValue={grade?.score} /></label>
            <label>Комментарий ученику<textarea name="comment" rows={3} maxLength={3000} defaultValue={grade?.comment} /></label></div>
          <Submit>Сохранить оценку</Submit>
        </form>}
      </section>;
    })}
  </CabinetFrame>;
}
