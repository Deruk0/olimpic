import Link from "next/link";
import { formats } from "../../../lib/model";
import { lessonEnd } from "../../../lib/lesson-time";
import { lessonPath, workPath } from "../../../lib/paths";
import type { ScheduleCard } from "../../../lib/student";
import { WorkBadge } from "../work-badge";
import { InterfaceIcon } from "../../interface-icons";
import { JoinLesson } from "./join-lesson";

const zone = "Europe/Moscow";
const dayNumber = new Intl.DateTimeFormat("ru-RU", { day: "numeric", timeZone: zone });
const monthShort = new Intl.DateTimeFormat("ru-RU", { month: "short", timeZone: zone });
const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: zone });
const clock = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: zone });
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });

function dayKey(date: Date) {
  return dayKeyFormat.format(date);
}
function shiftKey(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
function when(start: Date, now: Date) {
  const key = dayKey(start);
  const today = dayKey(now);
  if (key === today) return "Сегодня";
  if (key === shiftKey(today, 1)) return "Завтра";
  return weekday.format(start);
}

export function ScheduleBoard({ cards, now, focus, archive }: { cards: ScheduleCard[]; now: number; focus?: string; archive: boolean }) {
  const upcoming: ScheduleCard[] = [];
  const past: ScheduleCard[] = [];
  const cancelled: ScheduleCard[] = [];
  const numbers = new Map<string, number>();
  for (const [index, card] of cards.entries()) {
    numbers.set(card.id, index + 1);
    const end = lessonEnd(card.starts.getTime(), card.settings.duration);
    if (end > now && card.cancelled) cancelled.push(card);
    else if (end > now) upcoming.push(card);
    else past.push(card);
  }
  past.reverse();
  const next = upcoming[0];
  const later = upcoming.slice(1);
  const showPast = archive || !next || past.some(card => card.id === focus);
  return <div className="schedule-board">
    <h2 className="section-title schedule-section-title"><InterfaceIcon name="schedule" />Ближайшие занятия</h2>
    {next ? <ScheduleCardView card={next} index={numbers.get(next.id) ?? 0} now={now} focus={focus} featured /> :
      <p className="panel muted">Ближайших занятий пока нет.</p>}
    {!!later.length && <section>
      <h2 className="schedule-heading">Дальше</h2>
      <div className="schedule-list">{later.map(card => <ScheduleCardView key={card.id} card={card} index={numbers.get(card.id) ?? 0} now={now} focus={focus} />)}</div>
    </section>}
    {!!cancelled.length && <section>
      <h2 className="schedule-heading">Отменённые занятия</h2>
      <div className="schedule-list">{cancelled.map(card => <ScheduleCardView key={card.id} card={card} index={numbers.get(card.id) ?? 0} now={now} focus={focus} />)}</div>
    </section>}
    {!!past.length && <section className="schedule-past" id="history" aria-labelledby="schedule-history-title">
      <div className="split"><h2 id="schedule-history-title">Прошедшие занятия <span className="badge">{past.length}</span></h2>
        {next && <Link className="button secondary" prefetch={false} href={showPast ? "/cabinet/schedule#history" : "/cabinet/schedule?archive=1#history"}>{showPast ? "Свернуть" : "Показать архив"}</Link>}
      </div>
      {showPast && <div className="schedule-list">{past.map(card => <ScheduleCardView key={card.id} card={card} index={numbers.get(card.id) ?? 0} now={now} focus={focus} />)}</div>}
    </section>}
  </div>;
}

function ScheduleCardView({ card, index, now, focus, featured = false }: {
  card: ScheduleCard; index: number; now: number; focus?: string; featured?: boolean;
}) {
  const end = new Date(lessonEnd(card.starts.getTime(), card.settings.duration));
  const live = !card.cancelled && card.starts.getTime() <= now && end.getTime() > now;
  const format = formats[card.settings.format ?? "online"];
  const label = "Занятие " + index;
  return <article id={"lesson-" + card.id} className={"schedule-card" + (featured ? " is-featured" : "") + (focus === card.id ? " is-focus" : "")}>
    <time className="schedule-day" dateTime={card.starts.toISOString()}>
      <b>{dayNumber.format(card.starts)}</b>
      <span>{monthShort.format(card.starts).replace(".", "")}</span>
    </time>
    <div className="schedule-copy">
      <p className="schedule-kicker"><span>{when(card.starts, new Date(now))}</span><span>{label}</span>{live && <span className="schedule-live">Идёт сейчас</span>}</p>
      <h2>{card.title}</h2>
      <p className="schedule-meta">
        <span>{clock.format(card.starts)}–{clock.format(end)} МСК</span>
        <span>{format}</span>
        {card.cancelled && <span className="badge badge-danger">Урок отменён</span>}
        <span>{card.teacherName}</span>
        {card.settings.location && <span>{card.settings.location}</span>}
      </p>
      {!!card.topics.length && <p className="schedule-topics">{card.topics.join(" · ")}</p>}
      {!card.cancelled && <JoinLesson id={card.id} starts={card.starts.getTime()} ends={end.getTime()} format={card.settings.format ?? "online"} now={now} />}
    </div>
    <details className="schedule-materials">
      <summary>
        <span className="schedule-materials-heading"><InterfaceIcon name="library" /><span>Материалы занятия<small>Теория{card.works.length ? " и учебные работы" : ""}</small></span></span>
        <span className="schedule-materials-chevron"><InterfaceIcon name="chevronDown" /></span>
      </summary>
      <div className="schedule-material-grid">
        <section className="schedule-material-section">
          <div className="section-title"><InterfaceIcon name="theory" /><h3>Теория</h3></div>
          <p className="muted">Конспект и материалы к занятию</p>
          <Link className="button secondary" prefetch={false} href={lessonPath(card.id)}>Открыть теорию</Link>
        </section>
        {card.works.map(work => <section className={"schedule-material-section is-" + work.state} key={work.assignmentId + work.kind}>
          <div className="schedule-material-title"><div className="section-title"><InterfaceIcon name="homework" /><h3><Link prefetch={false} href={workPath(work.assignmentId, work.kind)}>{work.title}</Link></h3></div>
            <CompletionCircle completed={work.tasks.filter(task => task.completed).length} total={work.tasks.length} />
          </div>
          <div className="split"><WorkBadge state={work.state} /><small>Заданий · {work.tasks.length}</small></div>
          <ol className="schedule-material-tasks">{work.tasks.map(({ title, index, completed }, position) => <li key={index}>
            <Link className="schedule-material-task" prefetch={false} href={workPath(work.assignmentId, work.kind) + "?task=" + index}><span>{title || "Задача " + (position + 1)}</span><CompletionCircle completed={Number(completed)} total={1} /></Link>
          </li>)}</ol>
        </section>)}
      </div>
    </details>
  </article>;
}

function CompletionCircle({ completed, total }: { completed: number; total: number }) {
  const done = total > 0 && completed === total;
  const percent = total ? Math.round(completed / total * 100) : 0;
  return <span className={"schedule-completion" + (done ? " is-complete" : "")} role="img" aria-label={done ? "Выполнено" : "Выполнено " + completed + " из " + total}>
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <circle className="completion-track" cx="14" cy="14" r="11" />
      <circle className="completion-fill" cx="14" cy="14" r="11" pathLength="100" strokeDasharray={percent + " 100"} transform="rotate(-90 14 14)" />
      {done && <path className="completion-check" d="m9 14 3 3 7-7" />}
    </svg>
  </span>;
}
