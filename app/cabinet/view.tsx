import Link from "next/link";
import { FormattedText } from "../formatted-text";
import { notFound, redirect } from "next/navigation";
import { requireAccount } from "../../lib/auth";
import { first, rows } from "../../lib/db";
import { emptyProgram, formats, levels, recommendation, type Account, type Assignment, type Group, type Level, type ProgramKey, type ProgramRow, type Submission, type Trajectory, type WorkKind } from "../../lib/model";
import { workLabels, workSections, workStates } from "../../lib/work";
import { managementPath as detailPath, workPath } from "../../lib/paths";
import { mutate } from "../actions";
import { Hidden, ScheduleEditor, Submit, TrajectoryEditor } from "../components";
import { ProgramEditor } from "../program-editor";
import { Files, LessonMaterials, StudentLesson } from "../lesson-card";
import { CabinetFrame, cabinetNav } from "./frame";

type Member = Account & { group_id: string; group_name: string };
type Guidance = { id: string; group_id: string; message: string };
type Attendance = { assignment: string; student: string };
const date = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Moscow" });
const programKeys: ProgramKey[] = ["basic", "advanced", "diagnostic"];
export type CabinetQuery = { view?: string; level?: string; saved?: string; error?: string; work?: string; student?: string; kind?: string };

export async function renderCabinet(query: CabinetQuery, detail?: string) {
  const user = await requireAccount();
  const tabs = cabinetNav[user.role];
  const view = tabs.find(([id]) => id === query.view)?.[0] ?? tabs[0][0];
  if (detail && (!["groups", "schedule", "students", "review"].includes(view) || query.view !== view)) notFound();
  if (view === "homework") redirect("/cabinet/homework");
  if (view === "course") redirect("/cabinet/course");
  const scope = user.role === "methodist" ? "" : user.role === "curator" ? " WHERE curator=$1" : " WHERE id IN (SELECT group_id FROM members WHERE student=$1)";
  const groups = await rows<Group>("SELECT * FROM groups" + scope + " ORDER BY name", scope ? [user.id] : []);
  const ids = groups.map(g => g.id);
  const [programs, members, assignments, submissions, trajectories, guidance, attendance] = await Promise.all([
    rows<ProgramRow>("SELECT * FROM programs"),
    user.role === "student" ? [] : rows<Member>("SELECT a.*,m.group_id,g.name AS group_name FROM members m JOIN accounts a ON a.id=m.student JOIN groups g ON g.id=m.group_id WHERE g.id=ANY($1::text[]) ORDER BY a.name", [ids]),
    rows<Assignment>("SELECT a.*,g.name AS group_name FROM assignments a JOIN groups g ON g.id=a.group_id WHERE g.id=ANY($1::text[]) ORDER BY starts,id", [ids]),
    rows<Submission>("SELECT s.* FROM submissions s JOIN assignments a ON a.id=s.assignment WHERE a.group_id=ANY($1::text[])" + (user.role === "student" ? " AND s.student=$2" : ""), user.role === "student" ? [ids, user.id] : [ids]),
    rows<Trajectory>("SELECT t.* FROM trajectories t JOIN members m ON m.student=t.student WHERE m.group_id=ANY($1::text[])" + (user.role === "student" ? " AND t.student=$2" : ""), user.role === "student" ? [ids, user.id] : [ids]),
    user.role === "student" ? [] : rows<Guidance>("SELECT * FROM guidance WHERE group_id=ANY($1::text[]) ORDER BY created DESC", [ids]),
    rows<Attendance>("SELECT t.* FROM attendance t JOIN assignments a ON a.id=t.assignment WHERE a.group_id=ANY($1::text[])" + (user.role === "student" ? " AND t.student=$2" : ""), user.role === "student" ? [ids, user.id] : [ids])
  ]);
  const published = programs.filter(p => p.published).map(p => ({ ...p, draft: p.published! }));
  const editorLevel = programKeys.find(l => l === query.level) ?? "basic";
  const selected = programs.find(p => p.level === editorLevel);
  const detailTitle = detail && (view === "groups" ? groups.find(g => g.id === detail)?.name :
    view === "students" ? members.find(m => m.id === detail)?.name :
    view === "review" && !submissions.some(s => s.assignment === detail && s.student === query.student) ? undefined :
    assignments.find(a => a.id === detail)?.content.title);
  if (detail && !detailTitle) notFound();
  const reviews = view === "review" ? submissions.flatMap(submission => {
    const assignment = assignments.find(a => a.id === submission.assignment);
    const member = members.find(m => m.id === submission.student);
    if (!assignment || !member || (detail && (assignment.id !== detail || member.id !== query.student))) return [];
    return workSections(assignment, submission).filter(work => work.state !== "pending").map(work => ({ submission, assignment, member, ...work }));
  }).sort((a, b) => Number(a.state === "reviewed") - Number(b.state === "reviewed")) : [];
  const reviewKind = query.kind as WorkKind | undefined;
  if (detail && view === "review" && !reviews.some(review => !reviewKind || review.kind === reviewKind)) notFound();
  let lessonNumber = 0;
  const lessonNumbers = new Map(assignments.filter(a => a.kind === "lesson").map(a => [a.id, ++lessonNumber]));
  return <CabinetFrame user={user} view={view} title={detailTitle || tabs.find(([id]) => id === view)![1]} saved={query.saved} error={query.error}>
        {detail && <p><Link href={"/cabinet?view=" + view}>← К списку</Link></p>}
        {user.role === "methodist" && view === "programs" && <>
          <p className="muted">Опубликованные материалы доступны для назначения группам. Изменения в черновике сохраняются отдельно.</p>
          <div className="chips">{programKeys.map(level => <Link className={level === editorLevel ? "active" : ""} key={level} href={"/cabinet?view=programs&level=" + level}>{levels[level]}</Link>)}</div>
          <section className="panel"><div className="split"><h2>{levels[editorLevel]}</h2><span className="badge">{selected?.published ? "Есть публикация" : "Черновик"}</span></div>
            <ProgramEditor key={editorLevel} level={editorLevel} initial={selected?.draft ?? emptyProgram} />
          </section>
        </>}
        {user.role === "methodist" && view === "groups" && <>{groups.length ? groups.filter(group => !detail || group.id === detail).map(group => !detail ? <section className="panel" key={group.id}>
          <h2><Link href={detailPath(view, group.id)}>{group.name}</Link></h2><p>{members.filter(member => member.group_id === group.id).length} учеников</p>
        </section> : <section className="panel" key={group.id}>
          <h2>{group.name}</h2>
          <div className="roster">{members.filter(m => m.group_id === group.id).map(member => {
            const work = assignments.filter(a => a.group_id === member.group_id).flatMap(a => workSections(a, submissions.find(s => s.student === member.id && s.assignment === a.id)));
            const trajectory = trajectories.find(t => t.student === member.id);
            return <div key={member.id}><b>{member.name}</b><span>{work.filter(s => s.state !== "pending").length} сдано · {work.filter(s => s.state === "reviewed").length} проверено</span><span>Посещено: {attendance.filter(item => item.student === member.id).length}</span><span>{trajectory ? levels[trajectory.level] + " · " + trajectory.topics.length + " тем" : "План готовится"}</span></div>;
          })}</div>
          <form action={mutate} className="editor"><Hidden name="action" value="guidance" /><Hidden name="return" value="groups" /><Hidden name="group" value={group.id} />
            <Hidden name="detail" value="yes" />
            <label>Рекомендация куратору<textarea name="message" rows={2} required maxLength={1500} /></label><Submit>Отправить рекомендацию</Submit>
          </form>
          {guidance.filter(item => item.group_id === group.id).map(item => <p key={item.id} className="notice">{item.message}</p>)}
        </section>) : <Empty>Группы ещё не созданы.</Empty>}</>}
        {user.role === "curator" && view === "schedule" && <>
          {!detail && <>
            <p className="muted">{groups.map(group => group.name).join(" · ") || "У вас пока нет назначенных групп."}</p>
            <details className="panel" open={!!query.error}><summary>+ Назначить занятие</summary><ScheduleEditor groups={groups} programs={published} /></details>
            <ScheduleSections assignments={assignments} render={assignment => <section className="panel" key={assignment.id}><AssignmentHeader assignment={assignment} href={detailPath(view, assignment.id)} /></section>} />
            {!!guidance.length && <section className="panel"><h2>Рекомендации методиста</h2>
              {guidance.map(item => <p className="notice" key={item.id}><b>{groups.find(g => g.id === item.group_id)?.name}</b><br />{item.message}</p>)}
            </section>}
          </>}
          {assignments.filter(assignment => detail === assignment.id).map(assignment => <section className="panel" key={assignment.id}><AssignmentHeader assignment={assignment} />
            <details className="material"><summary>Материалы для проведения занятия</summary>
              <LessonMaterials assignment={assignment} showWorks={false} />
              {workSections(assignment).map(({ kind, tasks }) => <section className="lesson-section panel" key={kind}>
                <h3>{workLabels[kind]}{assignment.content.work?.[kind]?.title ? " · " + assignment.content.work[kind].title : ""}</h3>
                <FormattedText text={assignment.content.work?.[kind]?.instructions} />
                {tasks.map(({ task, index }) => <details className="lesson-block" key={index}><summary>{task.title} · {task.max} б.</summary>
                  <FormattedText text={task.prompt} />
                  {task.hint && <><b>Подсказка</b><FormattedText text={task.hint} /></>}
                  {task.solution && <><b>Разбор</b><FormattedText text={task.solution} /></>}
                  {task.rubric && <><b>Критерии проверки</b><FormattedText text={task.rubric} /></>}
                </details>)}
              </section>)}
            </details>
            <details className="material"><summary>Настройки занятия</summary><ScheduleEditor groups={[]} programs={[]} assignment={assignment} /></details>
            {assignment.settings.format !== "self" && <details><summary>Посещаемость</summary><div className="roster">
              {members.filter(m => m.group_id === assignment.group_id).map(member => {
                const attended = attendance.some(item => item.assignment === assignment.id && item.student === member.id);
                return <div className="split" key={member.id}><b>{member.name}</b><form action={mutate}>
                  <Hidden name="action" value="attendance" /><Hidden name="return" value="schedule" /><Hidden name="assignment" value={assignment.id} /><Hidden name="student" value={member.id} /><Hidden name="attended" value={attended ? "no" : "yes"} />
                  <Hidden name="detail" value="yes" />
                  <Submit secondary>{attended ? "✓ Посещено · снять" : "Отметить посещение"}</Submit>
                </form></div>;
              })}
            </div></details>}
          </section>)}
        </>}
        {user.role === "curator" && view === "review" && <>
          {!reviews.length && <Empty>Работы появятся здесь после сдачи учениками.</Empty>}
          {reviews.filter(review => !detail || !reviewKind || review.kind === reviewKind).map(({ submission, assignment, member, kind, tasks, state }) => {
            const key = assignment.id + ":" + member.id + ":" + kind;
            if (!detail) return <article className="panel split" key={key}><div><Link href={detailPath(view, assignment.id, member.id, kind)}>{member.name} · {assignment.content.title}</Link><div className="muted">{workLabels[kind]}</div></div><span className="badge">{workStates[state]}</span></article>;
            return <section className="panel work" key={key}>
              <div className="split"><h2>{member.name} · {workLabels[kind]}</h2><span className="badge">{workStates[state]}</span></div>
              <form action={mutate} className="editor">
                <Hidden name="action" value="grade" /><Hidden name="return" value="review" /><Hidden name="assignment" value={assignment.id} /><Hidden name="student" value={member.id} />
                <Hidden name="detail" value="yes" />
                <Hidden name="kind" value={kind} />
                {tasks.map(({ task, index }) => <fieldset key={index}><legend>{task.title}</legend>
                  <FormattedText text={task.prompt} /><Files submission={submission} task={index} />
                  {typeof submission.answers?.[index] === "string" && <p className="pre"><b>Ответ ученика</b><br />{submission.answers[index]}</p>}
                  {Array.isArray(submission.answers?.[index]) && <p><b>Выбор ученика:</b> {(submission.answers[index] as number[]).map(option => task.options?.[option]).join(", ")}</p>}
                  {!!task.correct?.length && <p><b>Ключ:</b> {task.correct.map(option => task.options?.[option]).join(", ")}</p>}
                  {task.modelAnswer && <details><summary>Образец идеального ответа</summary><FormattedText text={task.modelAnswer} /></details>}
                  {task.rubric && <details><summary>Критерии проверки</summary><FormattedText text={task.rubric} /></details>}
                  <label>Балл из {task.max}<input name={"score." + index} type="number" min={0} max={task.max} required defaultValue={submission.grades?.[index]?.score} /></label>
                  <label>Обратная связь<textarea name={"comment." + index} rows={2} required maxLength={3000} defaultValue={submission.grades?.[index]?.comment} /></label>
                </fieldset>)}
                <Submit>Сохранить проверку</Submit>
              </form>
            </section>;
          })}
        </>}
        {user.role === "curator" && view === "students" && <>
          {!members.length && <Empty>В группах пока нет учеников.</Empty>}
          {members.filter(member => !detail || member.id === detail).map(member => {
            const diagnostic = [...assignments].reverse().find(a => a.kind === "diagnostic" && a.group_id === member.group_id && submissions.some(s => s.assignment === a.id && s.student === member.id && s.grades));
            const grades = submissions.find(s => s.assignment === diagnostic?.id && s.student === member.id)?.grades;
            const result = diagnostic && grades ? recommendation(diagnostic.content.tasks, grades, programs) : null;
            const previous = trajectories.find(t => t.student === member.id);
            const choices = (level: Level) => [...new Set([...(published.find(p => p.level === level)?.published?.lessons.map(l => l.topic) ?? []), ...(diagnostic?.content.tasks.map(t => t.topic) ?? [])])];
            const status = previous ? "План опубликован" : result ? "Готова рекомендация" : "Ожидает диагностику";
            if (!detail) return <article className="panel split" key={member.id}><Link href={detailPath(view, member.id)}>{member.name}</Link><span className="badge">{status}</span></article>;
            return <section className="panel work" key={member.id}>
              <span className="badge">{status}</span>
              <p className="muted">{member.group_name} · {member.goal || "Цель пока не указана"}</p>
              {!result ? <p>Рекомендация появится после проверки всех заданий диагностики.</p> : <>
                <p><b>{levels[result.level]}</b> · {Math.round(result.percent * 10) / 10}% за диагностику. Порог продвинутого уровня — {result.threshold}%. Темы ниже {result.priorityThreshold}% стоят первыми в черновике.</p>
                <div className="chips">{result.results.map(topic => <span key={topic.name}>{topic.name} · {Math.round(topic.percent)}%</span>)}</div>
                <TrajectoryEditor key={JSON.stringify(previous ?? result)} student={member.id} initial={previous?.topics ?? result.topics} level={previous?.level ?? result.level} options={{ basic: choices("basic"), advanced: choices("advanced") }} />
              </>}
            </section>;
          })}
        </>}
        {user.role === "student" && view === "learn" && <>
          <div className="split">
            <p className="muted">{groups[0]?.name || "Вас пока не добавили в группу."}</p>
            {!user.goal && <p><a href="#goal">Указать цель подготовки ↓</a></p>}
          </div>
          <ScheduleSections assignments={assignments} render={assignment => <StudentLesson key={assignment.id} assignment={assignment}
            submission={submissions.find(s => s.assignment === assignment.id)}
            attended={attendance.some(item => item.assignment === assignment.id)} expanded={query.work === assignment.id}
            index={lessonNumbers.get(assignment.id) ?? 0} />} />
          {!user.goal && <section className="panel" id="goal"><h2>Целевая олимпиада</h2>
            {published.find(p => p.level === "diagnostic")?.published?.olympiad ? <form action={mutate} className="editor">
              <Hidden name="action" value="goal" /><Hidden name="return" value="learn" />
              <label>К чему вы готовитесь?<select name="goal"><option>{published.find(p => p.level === "diagnostic")?.published?.olympiad}</option></select></label><Submit>Подтвердить цель</Submit>
            </form> : <p>Методист ещё готовит программу.</p>}
          </section>}
        </>}
        {user.role === "student" && view === "plan" && (trajectories[0] ? <section className="panel">
          <div className="split"><h2>{user.goal || "План подготовки"}</h2><span className="badge">{levels[trajectories[0].level]}</span></div>
          <ol className="timeline">{trajectories[0].topics.map(topic => {
            const work = assignments.filter(a => a.kind === "lesson" && a.level === trajectories[0].level).flatMap(assignment =>
              workSections(assignment, submissions.find(s => s.assignment === assignment.id))
                .filter(section => section.tasks.some(({ task }) => task.topic === topic.name)).map(section => ({ assignment, ...section }))
            );
            const reviewed = work.filter(section => section.state === "reviewed").length;
            return <li key={topic.name}><b>{topic.name}</b><span>До {topic.due.split("-").reverse().join(".")} · {work.length ? reviewed + " из " + work.length + " проверено" : "Занятие готовится"}</span>
              {work.map(({ assignment, kind, state }) => <span key={assignment.id + kind}><Link href={workPath(assignment.id, kind)}>{assignment.content.title} · {workLabels[kind]}</Link> · {workStates[state]}</span>)}
            </li>;
          })}</ol><Link href="/cabinet?view=learn">Перейти к занятиям →</Link>
        </section> : <Empty>Куратор опубликует план после диагностики.</Empty>)}
  </CabinetFrame>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="panel muted">{children}</p>;
}
function ScheduleSections({ assignments, render }: { assignments: Assignment[]; render: (assignment: Assignment) => React.ReactNode }) {
  const now = Date.now();
  const upcoming: Assignment[] = [];
  const past: Assignment[] = [];
  for (const assignment of assignments) {
    const end = new Date(assignment.starts).getTime() + (assignment.settings.duration ?? 90) * 60_000;
    if (end > now) upcoming.push(assignment);
    else past.push(assignment);
  }
  return <>
    <h2 className="schedule-heading">Ближайшие занятия</h2>
    {upcoming.length ? upcoming.map(render) : <Empty>Ближайших занятий пока нет.</Empty>}
    {!!past.length && <><h2 className="schedule-heading">Прошедшие занятия</h2>{past.reverse().map(render)}</>}
  </>;
}
function AssignmentHeader({ assignment, href }: { assignment: Assignment; href?: string }) {
  return <div className="split assignment"><div><span className="eyebrow">{levels[assignment.level]} · {assignment.group_name}</span><h2>{href ? <Link href={href}>{assignment.content.title}</Link> : assignment.content.title}</h2><p className="muted">{date.format(new Date(assignment.starts))} МСК · {formats[assignment.settings.format ?? "online"]} · {assignment.settings.duration ?? 90} мин</p></div>
    {assignment.meeting && <a className="button secondary" target="_blank" rel="noopener noreferrer" href={assignment.meeting}>Видеовстреча ↗</a>}</div>;
}
