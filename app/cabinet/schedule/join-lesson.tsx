"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { lessonPath, roomPath } from "../../../lib/paths";
import { roomEarlyAccess } from "../../../lib/lesson-time";
import type { LessonSettings } from "../../../lib/model";

const openingTime = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow",
});

export function JoinLesson({ id, starts, ends, format, now }: {
  id: string; starts: number; ends: number; format: LessonSettings["format"]; now: number;
}) {
  const [current, setCurrent] = useState(now);
  const hint = useId();
  const opens = starts - roomEarlyAccess;
  useEffect(() => {
    const update = () => setCurrent(Date.now());
    update();
    const interval = setInterval(update, 30_000);
    const timeouts = [opens, ends].filter(time => time > Date.now()).map(time =>
      setTimeout(update, Math.min(time - Date.now() + 50, 2_147_483_647)));
    return () => { clearInterval(interval); timeouts.forEach(clearTimeout); };
  }, [opens, ends]);

  if (format === "self") return <div className="schedule-join">
    <Link className="button" href={lessonPath(id)}>Открыть самостоятельное занятие</Link>
    <small>Проходите материалы в своём темпе</small>
  </div>;
  if (format === "offline") return <div className="schedule-join">
    <span className="badge badge-neutral">Очное занятие</span>
    <small>{current >= ends ? "Занятие завершено" : "Место проведения указано в карточке"}</small>
  </div>;

  const available = current >= opens && current < ends;
  const message = current >= ends ? "Занятие завершено" :
    current < opens ? "Подключение откроется " + openingTime.format(opens) + " МСК · за 15 минут до начала" :
    "Видеокомната Olimpik";
  return <div className="schedule-join">
    {available ? <Link className="button" href={roomPath(id)} prefetch={false} aria-describedby={hint}>Подключиться к уроку</Link> :
      <button type="button" className="join-unavailable" disabled aria-describedby={hint}>Подключиться к уроку</button>}
    <small id={hint} aria-live="polite">{message}</small>
  </div>;
}
