"use client";

import { createElement, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { mutate } from "./actions";
import { formats, levels, type Assignment, type Group, type Level, type ProgramKey, type ProgramRow, type Topic } from "../lib/model";
import { DateField } from "./date-field";

export function Hidden({ name, value }: { name: string; value: string | number }) {
  return <input type="hidden" name={name} value={value} />;
}
export function Submit({ children, secondary = false, pendingLabel = "Сохранение…" }: { children: ReactNode; secondary?: boolean; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className={secondary ? "secondary" : ""}>{pending ? pendingLabel : children}</button>;
}
const subscribeToSelectSupport = () => () => {};
const supportsSelectPicker = () => CSS.supports("appearance: base-select") && CSS.supports("selector(::picker(select))");
const serverSelectSupport = () => false;

function ScheduleSelect({ children, ...props }: ComponentProps<"select">) {
  const custom = useSyncExternalStore(subscribeToSelectSupport, supportsSelectPicker, serverSelectSupport);
  return <select {...props} className="schedule-select">
    {custom && <button type="button">{createElement("selectedcontent")}</button>}
    {children}
  </select>;
}

export function ScheduleEditor({ groups, programs, assignment }: { groups: Group[]; programs: ProgramRow[]; assignment?: Assignment }) {
  const published = programs.filter(item => item.published);
  const [level, setLevel] = useState(published[0]?.level ?? "");
  const [format, setFormat] = useState<keyof typeof formats>(assignment?.settings.format ?? "online");
  const starts = assignment?.starts ? new Date(new Date(assignment.starts).getTime() + 3 * 3600000).toISOString().slice(0, 16) : undefined;
  if (!assignment && (!published.length || !groups.length)) return <p className="muted">Нужны опубликованные материалы и назначенная группа.</p>;
  return <form action={mutate} className="editor">
    <Hidden name="action" value={assignment ? "reschedule" : "schedule"} /><Hidden name="return" value="schedule" />
    {assignment && <Hidden name="detail" value="yes" />}
    {assignment && <Hidden name="assignment" value={assignment.id} />}
    <div className="formgrid">
      {!assignment && <>
      <label>Группа<ScheduleSelect name="group">{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</ScheduleSelect></label>
      <label>Программа<ScheduleSelect name="level" value={level} onChange={e => setLevel(e.target.value as ProgramKey)}>{published.map(p => <option key={p.level} value={p.level}>{levels[p.level]}</option>)}</ScheduleSelect></label>
      <label>Занятие<ScheduleSelect name="lesson" key={level}>{published.find(p => p.level === level)?.published?.lessons.map((lesson, i) => <option key={i} value={i}>{lesson.title}</option>)}</ScheduleSelect></label>
      </>}
      <DateField label="Дата и время (МСК)" name="starts" withTime defaultValue={starts} />
      <label>Формат<ScheduleSelect name="format" value={format} onChange={e => setFormat(e.target.value as keyof typeof formats)}>{Object.entries(formats).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</ScheduleSelect></label>
      <label>Длительность, мин<input name="duration" type="number" min={5} max={480} defaultValue={assignment?.settings.duration ?? 90} required /></label>
    </div>
    {format === "online" && <label>Ссылка на видеовстречу<input name="meeting" type="url" defaultValue={assignment?.meeting} placeholder="https://…" required /></label>}
    {format === "offline" && <label>Место проведения<input name="location" defaultValue={assignment?.settings.location} maxLength={300} required /></label>}
    {format === "online" && <label>Ссылка на запись (необязательно)<input name="recording" type="url" defaultValue={assignment?.settings.recording} placeholder="https://…" /></label>}
    <Submit>{assignment?.starts ? "Сохранить настройки занятия" : "Поставить в расписание"}</Submit>
  </form>;
}

export function TrajectoryEditor({ student, initial, level: initialLevel, options }: { student: string; initial: Topic[]; level: Level; options: Record<Level, string[]> }) {
  const [topics, setTopics] = useState(initial);
  const [level, setLevel] = useState(initialLevel);
  function move(i: number, direction: number) {
    const reordered = [...topics];
    [reordered[i], reordered[i + direction]] = [reordered[i + direction], reordered[i]];
    setTopics(reordered);
  }
  const unselected = options[level].filter(name => !topics.some(topic => topic.name === name));
  return <form action={mutate} className="editor">
    <Hidden name="action" value="trajectory" /><Hidden name="return" value="students" /><Hidden name="student" value={student} /><Hidden name="topicCount" value={topics.length} />
    <Hidden name="detail" value="yes" />
    <label>Уровень<select name="level" value={level} onChange={e => {
      const next = e.target.value as Level;
      setLevel(next);
      setTopics(topics.filter(topic => options[next].includes(topic.name)));
    }}><option value="basic">{levels.basic}</option><option value="advanced">{levels.advanced}</option></select></label>
    {topics.map((topic, i) => <div className="topic-edit" key={topic.name}>
      <Hidden name={"topic." + i} value={topic.name} /><b>{i + 1}. {topic.name}</b>
      <DateField label="Срок" name={"due." + i} value={topic.due}
        onChange={due => setTopics(current => current.map((t, j) => j === i ? { ...t, due } : t))} />
      <div className="controls">
        <button type="button" className="secondary" aria-label="Поднять тему" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
        <button type="button" className="secondary" aria-label="Опустить тему" disabled={i === topics.length - 1} onClick={() => move(i, 1)}>↓</button>
        <button type="button" className="plain" onClick={() => setTopics(topics.filter((_, j) => j !== i))}>Убрать</button>
      </div>
    </div>)}
    {!!unselected.length && <label>Добавить тему<select value="" onChange={e => setTopics([...topics, { name: e.target.value, due: "" }])}><option value="" disabled>Выберите тему</option>{unselected.map(name => <option key={name}>{name}</option>)}</select></label>}
    <Submit>Утвердить и опубликовать</Submit>
  </form>;
}
