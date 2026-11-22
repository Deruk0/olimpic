import Link from "next/link";
import { formats } from "../../../lib/model";
import { lessonEnd } from "../../../lib/lesson-time";
import { lessonPath, workPath } from "../../../lib/paths";
import type { ScheduleCard } from "../../../lib/student";
import { WorkBadge } from "../work-badge";
import { InterfaceIcon } from "../../interface-icons";
import { ScrollArea } from "../../scroll-area";
import { JoinLesson } from "./join-lesson";

const zone = "Europe/Moscow";
const dayNumber = new Intl.DateTimeFormat("ru-RU", { day: "numeric", timeZone: zone });
const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: zone });
const clock = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: zone });
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "long", timeZone: zone });
const weekLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: zone });
const minute = 60_000;
const dayMinutes = 24 * 60;
const minimumEventMinutes = 25;

function dayKey(date: Date) {
  return dayKeyFormat.format(date);
}
function shiftKey(key: string, days: number) {
  const date = new Date(key + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function dayStart(key: string) {
  return new Date(key + "T00:00:00+03:00");
}
function monday(key: string) {
  return shiftKey(key, -((new Date(key + "T00:00:00Z").getUTCDay() + 6) % 7));
}
function validDay(value?: string) {
  return value && /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) && value < "9999-12-20" && Number.isFinite(+dayStart(value)) &&
    dayKey(dayStart(value)) === value ? value : undefined;
}
function scheduleLink(week: string, day?: string, focus?: string) {
  return { pathname: "/cabinet/schedule", query: { week, day, focus } };
}
function endTime(card: ScheduleCard) {
  return lessonEnd(+card.starts, card.settings.duration);
}
function dayLessons(cards: ScheduleCard[], day: string) {
  const midnight = +dayStart(day);
  const events = cards.flatMap(card => {
    const start = Math.max(0, (+card.starts - midnight) / minute);
    const end = Math.min(dayMinutes, (endTime(card) - midnight) / minute);
    return start < end ? [{ card, start, end, lane: 0 }] : [];
  });
  const occupied: number[] = [];
  for (const event of events) {
    const free = occupied.findIndex(end => end <= event.start);
    event.lane = free === -1 ? occupied.length : free;
    occupied[event.lane] = Math.max(event.end, event.start + minimumEventMinutes);
  }
  return { day, events, lanes: Math.max(occupied.length, 1) };
}
export function ScheduleBoard({ cards, now, focus, week, day, archive }: {
  cards: ScheduleCard[]; now: number; focus?: string; week?: string; day?: string; archive: boolean;
}) {
  const ordered = [...cards].sort((a, b) => +a.starts - +b.starts);
  const today = dayKey(new Date(now));
  const focused = ordered.find(card => card.id === focus);
  const first = monday(validDay(week) ?? (focused ? dayKey(focused.starts) : today));
  const last = shiftKey(first, 6);
  const days = Array.from({ length: 7 }, (_, offset) => dayLessons(ordered, shiftKey(first, offset)));
  const events = days.flatMap(column => column.events);
  const next = ordered.find(card => !card.cancelled && endTime(card) > now);
  const nextOutsideWeek = next && !events.some(event => event.card === next) ? next : undefined;
  const requestedDay = days.find(column => column.day === day);
  const selected = requestedDay ? requestedDay.events.find(event => event.card.id === focus)?.card ?? requestedDay.events[0]?.card :
    events.find(event => event.card.id === focus)?.card ?? events.find(event => event.card === next)?.card ?? events[0]?.card;
  const selectedDay = requestedDay?.day ?? days.find(column => column.events.some(event => event.card === selected))?.day ??
    (today >= first && today <= last ? today : first);
  const dailyEvents = days.find(column => column.day === selectedDay)?.events ?? [];
  const firstHour = Math.floor(Math.min(15 * 60, ...events.map(event => event.start)) / 60);
  const lastHour = Math.ceil(Math.max(21 * 60, ...events.map(event => event.end)) / 60);
  const hours = Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index);
  const hoursSpan = hours.length * 60;
  const past = ordered.filter(card => endTime(card) <= now).reverse();
  return <div className="schedule-board">
    <nav className="week-toolbar" aria-label="Недели расписания">
      <Link className="button secondary" href={scheduleLink(shiftKey(first, -7))} scroll={false} aria-label="Предыдущая неделя">‹</Link>
      <strong>{weekLabel.formatRange(dayStart(first), dayStart(last))}</strong>
      <Link className="button secondary" href={scheduleLink(shiftKey(first, 7))} scroll={false} aria-label="Следующая неделя">›</Link>
      <Link className="button secondary" href={scheduleLink(monday(today), today)} scroll={false}>Сегодня</Link>
    </nav>
    <div className="week-workspace">
      <section className="week-calendar" aria-label="Расписание на неделю">
        <ScrollArea label="Сетка недели" className="week-grid-area" viewportClassName="week-calendar-scroll">
        <div className="week-header">
          <span className="week-zone">МСК</span>
          {days.map(({ day: date, events: lessons }) => <Link key={date} href={scheduleLink(first, date)} scroll={false}
            aria-current={date === selectedDay ? "date" : undefined} data-today={date === today}
            aria-label={dayLabel.format(dayStart(date)) + (lessons.length ? " · уроков " + lessons.length : "")}>
            <span>{weekday.format(dayStart(date))}</span> {dayNumber.format(dayStart(date))}
          </Link>)}
        </div>
        <div className="week-hours">
          <div className="week-times" aria-hidden="true">{hours.map(hour => <span key={hour}>{String(hour).padStart(2, "0")}:00</span>)}</div>
          {days.map(({ day: date, events: lessons, lanes }) => <div className="week-day" key={date} data-current={date === selectedDay}>
            {lessons.map(({ card, start, end, lane }) => <Link key={card.id} className="week-event"
              data-selected={card === selected} data-cancelled={card.cancelled} href={scheduleLink(first, date, card.id)} scroll={false}
              aria-current={card === selected && date === selectedDay ? "true" : undefined}
              aria-label={card.title + " · " + dayLabel.format(dayStart(date)) + ", " + clock.format(card.starts) + " МСК" + (card.cancelled ? " · Отменён" : "")}
              title={card.title + (card.cancelled ? " · Отменён" : "")}
              style={{ top: 100 * (start - firstHour * 60) / hoursSpan + "%", height: 100 * (end - start) / hoursSpan + "%",
                left: 100 * lane / lanes + "%", width: 100 / lanes + "%" }}>
              <small>{clock.format(card.starts)}</small><span>{card.title}</span>
              {card.cancelled && <small className="week-cancelled">Отменён</small>}
            </Link>)}
          </div>)}
        </div>
        </ScrollArea>
        <ScrollArea label="Занятия выбранного дня" className="week-agenda-area" viewportClassName="week-agenda" contentClassName="week-agenda-list">
          {dailyEvents.map(({ card }) => <Link key={card.id} href={scheduleLink(first, selectedDay, card.id)} scroll={false}
            aria-current={card === selected ? "true" : undefined}>
            <time dateTime={card.starts.toISOString()}>{clock.format(card.starts)}</time><span>{card.title}{card.cancelled && <small>Отменён</small>}</span>
          </Link>)}
          {!dailyEvents.length && <p className="muted">В этот день занятий нет.</p>}
        </ScrollArea>
      </section>
      {selected ? <ScheduleDetail card={selected} now={now} next={nextOutsideWeek} /> : <section className="week-inspector">
        <div className="week-inspector-body">
          <h2>{requestedDay ? "В этот день занятий нет" : "На этой неделе занятий нет"}</h2>
          {next && <Link href={scheduleLink(monday(dayKey(next.starts)), dayKey(next.starts), next.id)}>Перейти к ближайшему уроку →</Link>}
        </div>
      </section>}
    {!!past.length && <section className="schedule-past" id="history" aria-labelledby="schedule-history-title">
      <div className="split"><h2 id="schedule-history-title">Прошедшие занятия <span className="badge">{past.length}</span></h2>
        <Link className="button secondary" prefetch={false} href={{ ...scheduleLink(first, selectedDay, selected?.id), query: { week: first, day: selectedDay, focus: selected?.id, archive: archive ? undefined : 1 }, hash: "history" }}>{archive ? "Свернуть" : "Показать архив"}</Link>
      </div>
      {archive && <div className="list-stack">{past.map(card => <article className="list-card split" key={card.id}>
        <div><h3><Link href={scheduleLink(monday(dayKey(card.starts)), dayKey(card.starts), card.id)}>{card.title}</Link></h3>
          <p className="muted">{card.teacherName} · {dayLabel.format(card.starts)} · {clock.format(card.starts)} МСК</p></div>
        {card.cancelled && <span className="badge badge-danger">Урок отменён</span>}
      </article>)}</div>}
    </section>}
    </div>
  </div>;
}

function ScheduleDetail({ card, now, next }: { card: ScheduleCard; now: number; next?: ScheduleCard }) {
  const end = new Date(endTime(card));
  const live = !card.cancelled && card.starts.getTime() <= now && end.getTime() > now;
  const format = formats[card.settings.format ?? "online"];
  return <article id={"lesson-" + card.id} className="week-inspector">
    <div className="week-inspector-heading">
      <h2>{card.title}</h2>
    </div>
    <div className="week-inspector-body">
      <ul className="week-details">
        <li><InterfaceIcon name="schedule" /><time dateTime={card.starts.toISOString()}>{dayLabel.format(card.starts)}</time></li>
        <li><InterfaceIcon name="clock" /><span>{clock.format(card.starts)}–{clock.format(end)} <small>МСК</small></span></li>
        <li><InterfaceIcon name="profile" /><span>{card.teacherName}</span></li>
      </ul>
      <p className="schedule-meta"><span>{format}</span>{card.settings.location && <span>{card.settings.location}</span>}
        {card.cancelled && <span className="badge badge-danger">Урок отменён</span>}
        {live && <span className="schedule-live">Идёт сейчас</span>}</p>
      {!!card.topics.length && <p className="schedule-topics">{card.topics.join(" · ")}</p>}
      {!card.cancelled && <JoinLesson id={card.id} starts={card.starts.getTime()} ends={end.getTime()} format={card.settings.format ?? "online"} now={now} />}
      <details className="schedule-materials">
      <summary>
        <span className="schedule-materials-heading"><InterfaceIcon name="library" /><span>Материалы занятия<small>Теория{card.works.length ? " и учебные работы" : ""}</small></span></span>
        <span className="schedule-materials-chevron"><InterfaceIcon name="chevronDown" /></span>
      </summary>
      <div className="schedule-material-grid">
        <section className="schedule-material-section">
          <div className="section-title"><InterfaceIcon name="theory" /><h3>Теория</h3></div>
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
      {next && <p className="schedule-next"><Link href={scheduleLink(monday(dayKey(next.starts)), dayKey(next.starts), next.id)} scroll={false}>К ближайшему уроку →</Link></p>}
    </div>
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
