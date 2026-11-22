import { TaskOptionList } from "../task-answer";
import Link from "next/link";
import { FormattedText } from "../formatted-text";
import { notFound, redirect } from "next/navigation";
import { requireAccount } from "../../lib/auth";
import { first, rows } from "../../lib/db";
import { emptyProgram, formats, levels, recommendation, type Account, type Assignment, type Group, type Level, type ProgramKey, type ProgramRow, type Submission, type Trajectory, type WorkKind } from "../../lib/model";
import { workLabels, workSections, workStates } from "../../lib/work";
import { managementPath as detailPath } from "../../lib/paths";
import { mutate } from "../actions";
import { Hidden, ScheduleEditor, Submit, TrajectoryEditor } from "../components";
import { ProgramEditor } from "../program-editor";
import { Files, LessonMaterials } from "../lesson-card";
import { CabinetFrame, cabinetNav } from "./frame";
import { EmptyList, ListFilters } from "../list-filters";
import { DeleteAssignedLesson } from "../delete-assigned-lesson";

type Member = Account & { group_id: string; group_name: string };
type Guidance = { id: string; group_id: string; message: string };
type Attendance = { assignment: string; student: string };
const date = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Moscow" });
const programKeys: ProgramKey[] = ["basic", "advanced", "diagnostic"];
export type CabinetQuery = { view?: string; level?: string; saved?: string; error?: string; work?: string; student?: string; kind?: string; q?: string; status?: string; sort?: string; group?: string; deleted?: string };

export async function renderCabinet(query: CabinetQuery, detail?: string) {
  const user = await requireAccount();
  if (user.role === "student") redirect(query.view === "plan" ? "/cabinet/plan" : "/cabinet/schedule");
  const tabs = cabinetNav[user.role];
  const view = tabs.find(([id]) => id === query.view)?.[0] ?? tabs[0][0];
  if (detail && (!["groups", "schedule", "students", "review"].includes(view) || query.view !== view)) notFound();
  if (view === "library" || view === "planning" || view === "dev") redirect("/cabinet/" + view);
  const scope = user.role === "methodist" ? "" : " WHERE curator=$1";
  const groups = await rows<Group>("SELECT * FROM groups" + scope + " ORDER BY name", scope ? [user.id] : []);
  const ids = groups.map(g => g.id);
  const [programs, members, assignments, submissions, trajectories, guidance, attendance] = await Promise.all([
    rows<ProgramRow>("SELECT * FROM programs"),
    rows<Member>("SELECT a.*,m.group_id,g.name AS group_name FROM members m JOIN accounts a ON a.id=m.student JOIN groups g ON g.id=m.group_id WHERE g.id=ANY($1::text[]) ORDER BY a.name", [ids]),
    rows<Assignment>("SELECT a.*,g.name AS group_name FROM assignments a JOIN groups g ON g.id=a.group_id WHERE g.id=ANY($1::text[])" + (view === "schedule" ? " AND a.deleted_at IS NULL" : "") + " ORDER BY starts,id", [ids]),
    rows<Submission>("SELECT s.* FROM submissions s JOIN assignments a ON a.id=s.assignment WHERE a.group_id=ANY($1::text[])", [ids]),
    rows<Trajectory>("SELECT t.* FROM trajectories t JOIN members m ON m.student=t.student WHERE m.group_id=ANY($1::text[])", [ids]),
    rows<Guidance>("SELECT * FROM guidance WHERE group_id=ANY($1::text[]) ORDER BY created DESC", [ids]),
    rows<Attendance>("SELECT t.* FROM attendance t JOIN assignments a ON a.id=t.assignment WHERE a.group_id=ANY($1::text[])", [ids])
  ]);
  const published = programs.filter(p => p.published).map(p => ({ ...p, draft: p.published! }));
  const editorLevel = programKeys.find(l => l === query.level) ?? "basic";
  const selected = programs.find(p => p.level === editorLevel);
  const detailTitle = detail && (view === "groups" ? groups.find(g => g.id === detail)?.name :
    view === "students" ? members.find(m => m.id === detail)?.name :
    view === "review" && !submissions.some(s => s.assignment === detail && s.student === query.student) ? undefined :
    assignments.find(a => a.id === detail)?.content.title);
  if (detail && !detailTitle) notFound();
  const sharedGoal = detail && user.role === "curator" && view === "students"
    ? await first<{ result_text: string | null }>(
      "SELECT p.details->>'resultText' AS result_text FROM student_goal_profiles p " +
      "JOIN members m ON m.student=p.student JOIN groups g ON g.id=m.group_id WHERE p.student=$1 AND g.curator=$2",
      [detail, user.id]
    )
    : null;
  const reviews = view === "review" ? submissions.flatMap(submission => {
    const assignment = assignments.find(a => a.id === submission.assignment);
    const member = members.find(m => m.id === submission.student && m.group_id === assignment?.group_id);
    if (!assignment || !member || (detail && (assignment.id !== detail || member.id !== query.student))) return [];
    return workSections(assignment, submission).filter(work => work.state !== "pending").map(work => ({ submission, assignment, member, ...work }));
  }).sort((a, b) => Number(a.state === "reviewed") - Number(b.state === "reviewed")) : [];
  const reviewKind = query.kind as WorkKind | undefined;
  if (detail && view === "review" && !reviews.some(review => !reviewKind || review.kind === reviewKind)) notFound();
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";
  const matches = (text: string) => text.toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru"));
  const groupFilter = groups.find(group => group.id === query.group)?.id ?? "";
  const groupOptions = [["", "Все группы"], ...groups.map(group => [group.id, group.name] as const)] as const;
  const listSort = query.sort === "reverse" ? "reverse" : "name";
  const nameOptions = [["name", "По имени · А–Я"], ["reverse", "По имени · Я–А"]] as const;
  const visibleGroups = groups.filter(group => matches(group.name));
  const visibleMembers = members.filter(member => matches(member.name) && (!groupFilter || member.group_id === groupFilter));
  if (listSort === "reverse") {
    visibleGroups.reverse();
    visibleMembers.reverse();
  }
  const reviewStatus = query.status === "awaiting" || query.status === "reviewed" ? query.status : "all";
  const reviewType = Object.hasOwn(workLabels, query.kind ?? "") ? query.kind! : "all";
  const reviewSort = query.sort === "name" ? "name" : "pending";
  const visibleReviews = reviews.filter(review =>
    (detail || (reviewStatus === "all" || review.state === reviewStatus) && (reviewType === "all" || review.kind === reviewType) &&
      (!groupFilter || review.assignment.group_id === groupFilter) &&
      matches(review.member.name + " " + review.assignment.content.title))
  );
  if (!detail && reviewSort === "name") visibleReviews.sort((a, b) => a.member.name.localeCompare(b.member.name, "ru"));
  return <CabinetFrame user={user} view={view} title={detailTitle || tabs.find(([id]) => id === view)![1]} saved={query.saved} error={query.error}>
        {detail && <p><Link href={"/cabinet?view=" + view}>← К списку</Link></p>}
        {user.role === "methodist" && view === "programs" && <>
          <p className="muted">Опубликованные материалы доступны для назначения группам. Изменения в черновике сохраняются отдельно.</p>
          <div className="chips">{programKeys.map(level => <Link className={level === editorLevel ? "active" : ""} key={level} href={"/cabinet?view=programs&level=" + level}>{levels[level]}</Link>)}</div>
          <section className="panel"><div className="split"><h2>{levels[editorLevel]}</h2><span className="badge">{selected?.published ? "Есть публикация" : "Черновик"}</span></div>
            <ProgramEditor key={editorLevel} level={editorLevel} initial={selected?.draft ?? emptyProgram} />
          </section>
        </>}
        {view === "groups" && <>
          {!detail && <ListFilters action="/cabinet" hidden={{ view }} search={search} placeholder="Название группы" reset="/cabinet?view=groups" count={visibleGroups.length} filters={[
            { name: "sort", label: "Сортировка", value: listSort, options: [["name", "По названию · А–Я"], ["reverse", "По названию · Я–А"]] },
          ]} />}
          {!detail && !visibleGroups.length && <EmptyList reset="/cabinet?view=groups" />}
          {groups.length ? (detail ? groups : visibleGroups).filter(group => !detail || group.id === detail).map(group => !detail ? <section className="panel split list-card" key={group.id}>
          <div><h2><Link href={detailPath(view, group.id)}>{group.name}</Link></h2><p>{members.filter(member => member.group_id === group.id).length} учеников</p></div>
          <Link className="button secondary" href={detailPath(view, group.id)}>Посмотреть прогресс</Link>
        </section> : <section className="panel" key={group.id}>
          <h2>{group.name}</h2>
          {user.role === "curator" && <Link className="button secondary" href={"/cabinet?view=schedule&group=" + encodeURIComponent(group.id)}>Расписание группы</Link>}
          {!members.some(member => member.group_id === group.id) && <p className="muted">В группе пока нет учеников.</p>}
          <div className="roster">{members.filter(m => m.group_id === group.id).map(member => {
            const activeAssignments = assignments.filter(a => a.group_id === group.id && !a.deleted_at);
            const work = activeAssignments.flatMap(a => workSections(a, submissions.find(s => s.student === member.id && s.assignment === a.id)));
            const trajectory = trajectories.find(t => t.student === member.id);
            const groupAssignments = new Set(activeAssignments.map(a => a.id));
            const visited = attendance.filter(item => item.student === member.id && groupAssignments.has(item.assignment)).length;
            return <div key={member.id}>
              <b>{user.role === "curator" ? <Link href={detailPath("students", member.id)}>{member.name}</Link> : member.name}</b>
              <span>{work.filter(s => s.state !== "pending").length} сдано · {work.filter(s => s.state === "reviewed").length} проверено</span>
              <span>Посещено: {visited}</span><span>{trajectory ? levels[trajectory.level] + " · " + trajectory.topics.length + " тем" : "План готовится"}</span>
            </div>;
          })}</div>
          {user.role === "methodist" && <form action={mutate} className="editor"><Hidden name="action" value="guidance" /><Hidden name="return" value="groups" /><Hidden name="group" value={group.id} />
            <Hidden name="detail" value="yes" />
            <label>Рекомендация куратору<textarea name="message" rows={2} required maxLength={1500} /></label><Submit>Отправить рекомендацию</Submit>
          </form>}
          {guidance.filter(item => item.group_id === group.id).map(item => <p key={item.id} className="notice">{item.message}</p>)}
        </section>) : null}</>}
        {user.role === "curator" && view === "schedule" && <>
          {query.deleted === "1" && <p className="notice" role="status">Занятие удалено из расписания. Сданные работы доступны в разделе проверки.</p>}
          {!detail && <>
            {groups.length === 0 ? <p className="muted">У вас пока нет назначенных групп.</p> :
              <nav className="chips" aria-label="Группы в расписании">
                {groupOptions.map(([id, name]) => <Link key={id} className={groupFilter === id ? "active" : ""}
                  aria-current={groupFilter === id ? "page" : undefined}
                  href={"/cabinet?view=schedule" + (id ? "&group=" + encodeURIComponent(id) : "")}>{name}</Link>)}
              </nav>}
            <details className="panel" open={!!query.error}><summary>+ Назначить входную диагностику</summary><ScheduleEditor groups={groups} programs={published.filter(program => program.level === "diagnostic")} /></details>
            <ScheduleSections assignments={assignments.filter(a => !groupFilter || a.group_id === groupFilter)}
              render={assignment => <section className="panel" key={assignment.id}><AssignmentHeader assignment={assignment} href={detailPath(view, assignment.id)} /></section>} />
            {!!guidance.length && <section className="panel"><h2>Рекомендации методиста</h2>
              {guidance.map(item => <p className="notice" key={item.id}><b>{groups.find(g => g.id === item.group_id)?.name}</b><br />{item.message}</p>)}
            </section>}
          </>}
          {assignments.filter(assignment => detail === assignment.id).map(assignment => <section className="panel" key={assignment.id}><AssignmentHeader assignment={assignment} />
            <details className="material"><summary>Материалы для проведения занятия</summary>
              <LessonMaterials assignment={assignment} />
              {workSections(assignment).map(({ kind, tasks }) => <section className="lesson-section panel" key={kind}>
                <h3>{workLabels[kind]}{assignment.content.work?.[kind]?.title ? " · " + assignment.content.work[kind].title : ""}</h3>
                <FormattedText text={assignment.content.work?.[kind]?.instructions} />
                {tasks.map(({ task, index }) => <details className="lesson-block" key={index}><summary>{task.title} · {task.max} б.</summary>
                  <FormattedText text={task.prompt} />
                  {!!task.options?.length && <TaskOptionList task={task} indexes={task.options.map((_, i) => i)} />}
                  {task.hint && <><b>Подсказка</b><FormattedText text={task.hint} /></>}
                  {task.solution && <><b>Разбор</b><FormattedText text={task.solution} /></>}
                  {task.modelAnswer && <><b>Образец решения</b><FormattedText text={task.modelAnswer} /></>}
                  {task.rubric && <><b>Критерии проверки</b><FormattedText text={task.rubric} /></>}
                </details>)}
              </section>)}
            </details>
            <details className="material" open={!assignment.starts || !!query.error}><summary>{assignment.starts ? "Настройки занятия" : "Поставить в расписание"}</summary><ScheduleEditor groups={[]} programs={[]} assignment={assignment} /></details>
            {assignment.starts && assignment.settings.format !== "self" && <details><summary>Посещаемость</summary><div className="roster">
              {members.filter(m => m.group_id === assignment.group_id).map(member => {
                const attended = attendance.some(item => item.assignment === assignment.id && item.student === member.id);
                return <div className="split" key={member.id}><b><Link href={detailPath("students", member.id)}>{member.name}</Link></b><form action={mutate}>
                  <Hidden name="action" value="attendance" /><Hidden name="return" value="schedule" /><Hidden name="assignment" value={assignment.id} /><Hidden name="student" value={member.id} /><Hidden name="attended" value={attended ? "no" : "yes"} />
                  <Hidden name="detail" value="yes" />
                  <Submit secondary>{attended ? "✓ Посещено · снять" : "Отметить посещение"}</Submit>
                </form></div>;
              })}
            </div></details>}
            <DeleteAssignedLesson id={assignment.id} title={assignment.content.title} />
          </section>)}
        </>}
        {user.role === "curator" && view === "review" && <>
          {!detail && <ListFilters action="/cabinet" hidden={{ view }} search={search} placeholder="Ученик или название занятия" reset="/cabinet?view=review" count={visibleReviews.length} filters={[
            { name: "group", label: "Группа", value: groupFilter, options: groupOptions },
            { name: "status", label: "Статус", value: reviewStatus, options: [["all", "Все сданные"], ["awaiting", "Ждут проверки"], ["reviewed", "Проверены"]] },
            { name: "kind", label: "Тип работы", value: reviewType, options: [["all", "Все типы"], ...Object.entries(workLabels)] },
            { name: "sort", label: "Сортировка", value: reviewSort, options: [["pending", "Сначала без проверки"], ["name", "По ученику · А–Я"]] },
          ]} />}
          {!detail && !visibleReviews.length && <EmptyList reset="/cabinet?view=review" />}
          {visibleReviews.filter(review => !detail || !reviewKind || review.kind === reviewKind).map(({ submission, assignment, member, kind, tasks, state }) => {
            const key = assignment.id + ":" + member.id + ":" + kind;
            if (!detail) return <article className="panel split list-card" key={key}><div><h2><Link href={detailPath(view, assignment.id, member.id, kind)}>{member.name}</Link></h2><p className="muted">{assignment.content.title} · {workLabels[kind]}</p><span className={"badge" + (state === "reviewed" ? " badge-success" : "")}>{workStates[state]}</span>{assignment.deleted_at && <span className="badge badge-neutral">Занятие удалено</span>}</div>
              <Link className={"button" + (state === "reviewed" ? " secondary" : "")} href={detailPath(view, assignment.id, member.id, kind)}>{state === "reviewed" ? "Посмотреть проверку" : "Проверить работу"}</Link></article>;
            return <section className="panel work" key={key}>
              {assignment.deleted_at && <p className="notice">Занятие удалено из расписания. Здесь сохранена сданная работа.</p>}
              <div className="split"><h2>{member.name} · {workLabels[kind]}</h2><span className="badge">{workStates[state]}</span></div>
              <form action={mutate} className="editor">
                <Hidden name="action" value="grade" /><Hidden name="return" value="review" /><Hidden name="assignment" value={assignment.id} /><Hidden name="student" value={member.id} />
                <Hidden name="detail" value="yes" />
                <Hidden name="kind" value={kind} />
                {tasks.map(({ task, index }) => <fieldset key={index}><legend>{task.title}</legend>
                  <FormattedText text={task.prompt} /><Files submission={submission} task={index} />
                  {typeof submission.answers?.[index] === "string" && <p className="pre"><b>Ответ ученика</b><br />{submission.answers[index]}</p>}
                  {Array.isArray(submission.answers?.[index]) && <div><b>Выбор ученика</b><TaskOptionList task={task} indexes={submission.answers[index] as number[]} /></div>}
                  {!!task.correct?.length && <div><b>Ключ</b><TaskOptionList task={task} indexes={task.correct} /></div>}
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
          {!detail && <ListFilters action="/cabinet" hidden={{ view }} search={search} placeholder="Имя ученика" reset="/cabinet?view=students" count={visibleMembers.length} filters={[
            { name: "group", label: "Группа", value: groupFilter, options: groupOptions },
            { name: "sort", label: "Сортировка", value: listSort, options: nameOptions },
          ]} />}
          {!detail && !visibleMembers.length && <EmptyList reset="/cabinet?view=students" />}
          {(detail ? members : visibleMembers).filter(member => !detail || member.id === detail).map(member => {
            const diagnostic = [...assignments].reverse().find(a => a.kind === "diagnostic" && a.group_id === member.group_id && submissions.some(s => s.assignment === a.id && s.student === member.id && s.grades));
            const grades = submissions.find(s => s.assignment === diagnostic?.id && s.student === member.id)?.grades;
            const result = diagnostic && grades ? recommendation(diagnostic.content.tasks, grades, programs) : null;
            const previous = trajectories.find(t => t.student === member.id);
            const choices = (level: Level) => [...new Set([...(published.find(p => p.level === level)?.published?.lessons.map(l => l.topic) ?? []), ...(diagnostic?.content.tasks.map(t => t.topic) ?? [])])];
            const status = previous ? "План опубликован" : result ? "Готова рекомендация" : "Ожидает диагностику";
            if (!detail) return <article className="panel split list-card" key={member.id}><div><h2><Link href={detailPath(view, member.id)}>{member.name}</Link></h2><p className="muted">{member.group_name}</p><span className="badge">{status}</span></div><Link className="button secondary" href={detailPath(view, member.id)}>Открыть траекторию</Link></article>;
            return <div key={member.id}>
            <section className="panel work">
              <span className="badge">{status}</span>
              <p className="muted"><Link href={detailPath("groups", member.group_id)}>{member.group_name}</Link>{member.goal && " · " + member.goal}</p>
              {sharedGoal?.result_text && <div>
                <h2>Желаемый результат</h2>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{sharedGoal.result_text}</p>
              </div>}
              {!result ? <p>Рекомендация появится после проверки всех заданий диагностики.</p> : <>
                <p><b>{levels[result.level]}</b> · {Math.round(result.percent * 10) / 10}% за диагностику. Порог продвинутого уровня — {result.threshold}%. Темы ниже {result.priorityThreshold}% стоят первыми в черновике.</p>
                <div className="chips">{result.results.map(topic => <span key={topic.name}>{topic.name} · {Math.round(topic.percent)}%</span>)}</div>
                <TrajectoryEditor key={JSON.stringify(previous ?? result)} student={member.id} initial={previous?.topics ?? result.topics} level={previous?.level ?? result.level} options={{ basic: choices("basic"), advanced: choices("advanced") }} />
              </>}
            </section>
            <StudentLessonProgress member={member} assignments={assignments} submissions={submissions} attendance={attendance} />
            </div>;
          })}
        </>}
  </CabinetFrame>;
}
function StudentLessonProgress({ member, assignments, submissions, attendance }: {
  member: Member; assignments: Assignment[]; submissions: Submission[]; attendance: Attendance[];
}) {
  const studentSubmissions = new Map(submissions.filter(s => s.student === member.id).map(s => [s.assignment, s]));
  const visits = new Set(attendance.filter(item => item.student === member.id).map(item => item.assignment));
  const lessons = assignments.filter(a => a.group_id === member.group_id && !a.deleted_at).map(assignment => {
    const submission = studentSubmissions.get(assignment.id);
    return { assignment, submission, works: workSections(assignment, submission) };
  });
  const works = lessons.flatMap(lesson => lesson.works);
  return <section className="panel">
    <h2>Прогресс по урокам</h2>
    {!lessons.length ? <p className="muted">Группе пока не назначили занятия.</p> : <>
      <div className="chips">
        <span>Посещено: {lessons.filter(({ assignment }) => visits.has(assignment.id)).length}</span>
        <span>Работ сдано: {works.filter(work => work.state !== "pending").length} из {works.length}</span>
        <span>Проверено: {works.filter(work => work.state === "reviewed").length}</span>
      </div>
      <div className="roster">
        {lessons.map(({ assignment, submission, works }) => <div key={assignment.id}>
          <b><Link href={detailPath("schedule", assignment.id)}>{assignment.content.title}</Link></b>
          <span>{assignment.starts ? date.format(new Date(assignment.starts)) + " МСК" : "Дата не назначена"}</span>
          <span>{visits.has(assignment.id) ? "Посещение отмечено" : "Посещение не отмечено"}</span>
          {works.length ? works.map(({ kind, state, tasks }) => {
            const score = tasks.reduce((sum, { index }) => sum + (submission?.grades?.[index]?.score ?? 0), 0);
            const max = tasks.reduce((sum, { task }) => sum + task.max, 0);
            const label = workLabels[kind] + " · " + workStates[state] + (state === "reviewed" ? " · " + score + " из " + max : "");
            return state === "pending" ? <span key={kind}>{label}</span> :
              <Link key={kind} href={detailPath("review", assignment.id, member.id, kind)}>{label}</Link>;
          }) : <span>Работ к сдаче нет</span>}
        </div>)}
      </div>
    </>}
  </section>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="panel muted">{children}</p>;
}
function ScheduleSections({ assignments, render }: { assignments: Assignment[]; render: (assignment: Assignment) => React.ReactNode }) {
  const now = Date.now();
  const pending: Assignment[] = [];
  const upcoming: Assignment[] = [];
  const past: Assignment[] = [];
  for (const assignment of assignments) {
    if (!assignment.starts) { pending.push(assignment); continue; }
    const end = new Date(assignment.starts).getTime() + (assignment.settings.duration ?? 90) * 60_000;
    if (end > now) upcoming.push(assignment);
    else past.push(assignment);
  }
  return <>
    {!!pending.length && <section><h2 className="schedule-heading">Назначены методистом · без даты</h2>{pending.map(render)}</section>}
    <h2 className="schedule-heading">Ближайшие занятия</h2>
    {upcoming.length ? upcoming.map(render) : <Empty>Ближайших занятий пока нет.</Empty>}
    {!!past.length && <><h2 className="schedule-heading">Прошедшие занятия</h2>{past.reverse().map(render)}</>}
  </>;
}
function AssignmentHeader({ assignment, href }: { assignment: Assignment; href?: string }) {
  return <div className="split assignment"><div><span className="eyebrow">{levels[assignment.level]} · {assignment.group_name}</span><h2>{href ? <Link href={href}>{assignment.content.title}</Link> : assignment.content.title}</h2><p className="muted">{assignment.starts ? date.format(new Date(assignment.starts)) + " МСК · " + formats[assignment.settings.format ?? "online"] + " · " + (assignment.settings.duration ?? 90) + " мин" : "Ожидает даты проведения"}</p></div>
    {assignment.meeting && <a className="button secondary" target="_blank" rel="noopener noreferrer" href={assignment.meeting}>Видеовстреча ↗</a>}</div>;
}
