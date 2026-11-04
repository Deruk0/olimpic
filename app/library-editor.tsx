"use client";

import { useActionState, useState } from "react";
import { Hidden } from "./components";
import { saveLibrary, savePlannedLesson } from "./library-actions";
import { Theory } from "./program-editor";
import { TextEditor } from "./text-editor";
import { FormattedText } from "./formatted-text";
import { libraryWorkKinds, type LibraryEntry, type LibraryKind, type LibraryWorkKind } from "../lib/library";
import { formats, levels, type Assignment, type Group, type Lesson, type Task } from "../lib/model";
import { workKind, workLabels } from "../lib/work";

type BankTask = Extract<LibraryEntry, { kind: "task" }>;
const answerLabels = { file: "Файл", text: "Письменный ответ", single: "Один вариант", multiple: "Несколько вариантов" };
function reorder(items: string[], index: number, step: number) {
  const next = [...items];
  [next[index], next[index + step]] = [next[index + step], next[index]];
  return next;
}

export function LibraryEditor({ kind, entry, tasks }: { kind: LibraryKind; entry?: LibraryEntry; tasks: BankTask[] }) {
  const [result, action, pending] = useActionState(saveLibrary, { error: "" });
  const [title, setTitle] = useState(entry?.title ?? "");
  const [theory, setTheory] = useState<Lesson>({ title: "", topic: "", theory: "", materials: [], ...(entry?.kind === "theory" ? entry.data : {}), tasks: [] });
  const [task, setTask] = useState<Task>(entry?.kind === "task" ? entry.data : { title: "", topic: "", prompt: "", max: 5, response: "text" });
  const options = task.options ?? ["", ""];
  const correct = task.correct ?? [];
  const [work, setWork] = useState(entry?.kind === "work" ? entry.data : { title: "", kind: "homework" as LibraryWorkKind, tasks: [], settings: {} });
  const [selected, setSelected] = useState(work.tasks.map(item => item.id));
  const [filter, setFilter] = useState("");
  const available = tasks.filter(item => !selected.includes(item.id) && (item.title + " " + item.data.topic).toLowerCase().includes(filter.trim().toLowerCase()));
  const taskText = (name: "topic" | "prompt" | "hint" | "solution" | "rubric", label: string, max: number) =>
    name === "topic" ? <label>{label}<input name={name} maxLength={max} value={task.topic} onChange={event => setTask({ ...task, topic: event.target.value })} /></label> :
      <TextEditor label={label} name={name} maxLength={max} value={task[name] ?? ""} onChange={value => setTask({ ...task, [name]: value })} />;
  return <form className="editor library-editor" action={action}>
    <Hidden name="kind" value={kind} /><Hidden name="id" value={entry?.id ?? ""} />
    <label>Название<input name="title" maxLength={120} value={title} onChange={event => setTitle(event.target.value)} /></label>
    {kind === "theory" && <>
      <Hidden name="theory" value={JSON.stringify(theory)} />
      <label>Тема<input maxLength={100} value={theory.topic} onChange={event => setTheory({ ...theory, topic: event.target.value })} /></label>
      <fieldset className="builder-fields"><legend>Блоки теории</legend><Theory lesson={theory} update={patch => setTheory(current => ({ ...current, ...patch }))} /></fieldset>
    </>}
    {kind === "task" && <div className="library-workbench"><div className="library-fields">
      {taskText("topic", "Тема", 100)}
      {taskText("prompt", "Условие", 5000)}
      <label>Формат ответа<select name="response" value={task.response ?? "file"} onChange={event => setTask({ ...task, response: event.target.value as Task["response"], correct: [] })}>
        <option value="text">Письменный ответ</option><option value="single">Один вариант</option><option value="multiple">Несколько вариантов</option><option value="file">Файл с решением</option>
      </select></label>
      {(task.response === "single" || task.response === "multiple") && <fieldset><legend>Варианты и ключ для куратора</legend>
        {options.map((option, i) => <div className="formgrid" key={i}>
          <label>Вариант {i + 1}<input name="option" maxLength={500} value={option} onChange={event => setTask({ ...task, options: options.map((value, j) => j === i ? event.target.value : value) })} /></label>
          <label>Правильный вариант {i + 1}<input type={task.response === "single" ? "radio" : "checkbox"} name="correct" value={i} checked={correct.includes(i)} onChange={event => setTask({ ...task, correct: task.response === "single" ? [i] : event.target.checked ? [...correct, i] : correct.filter(j => j !== i) })} /></label>
          <button className="plain" type="button" disabled={options.length <= 2} onClick={() => setTask({ ...task, options: options.filter((_, j) => j !== i), correct: correct.filter(j => j !== i).map(j => j > i ? j - 1 : j) })}>Удалить вариант</button>
        </div>)}
        <button className="secondary" type="button" disabled={options.length >= 12} onClick={() => setTask({ ...task, options: [...options, ""] })}>+ Вариант</button>
      </fieldset>}
      {task.response === "text" && <TextEditor label="Образец идеального ответа · только для куратора" name="modelAnswer" rows={5} maxLength={8000} value={task.modelAnswer ?? ""} onChange={modelAnswer => setTask({ ...task, modelAnswer })} />}
      <label>Максимум баллов<input name="max" type="number" min={1} max={100} required value={task.max} onChange={event => setTask({ ...task, max: Number(event.target.value) })} /></label>
      {taskText("hint", "Подсказка для практики", 3000)}
      {taskText("solution", "Разбор для самопроверки в практике", 6000)}
      {taskText("rubric", "Критерии проверки · только для куратора", 5000)}
    </div><section className="library-preview panel">
      <p className="eyebrow">Предпросмотр ученика</p>
      <h3>{title || "Название задачи"}</h3>
      <FormattedText text={task.prompt || "Здесь появится условие."} />
      <span className="badge">{answerLabels[task.response ?? "file"]} · {task.max} б.</span>
      {(task.response === "single" || task.response === "multiple") && <ul>
        {options.map((option, index) => <li key={index}>{option || "Вариант " + (index + 1)}</li>)}
      </ul>}
      {task.response === "text" && <p className="lesson-block muted">Поле для письменного ответа</p>}
      {(!task.response || task.response === "file") && <p className="lesson-block muted">Загрузка файла с решением</p>}
      <small>Ключ, образец и критерии доступны куратору.</small>
    </section></div>}
    {kind === "work" && <>
      <label>Тип работы<select name="workKind" value={work.kind} onChange={event => setWork({ ...work, kind: event.target.value as LibraryWorkKind })}>{libraryWorkKinds.map(item => <option key={item} value={item}>{workLabels[item]}</option>)}</select></label>
      <TextEditor label="Инструкция" name="instructions" maxLength={5000} value={work.settings.instructions ?? ""} onChange={instructions => setWork({ ...work, settings: { ...work.settings, instructions } })} />
      {work.kind === "homework" && <label>Срок после занятия, дней<input name="dueDays" type="number" min={1} max={90} value={work.settings.dueDays ?? ""} onChange={event => setWork({ ...work, settings: { ...work.settings, dueDays: event.target.value ? Number(event.target.value) : undefined } })} /></label>}
      {work.kind === "assessment" && <div className="formgrid">
        <label>Рекомендуемое время, мин<input name="minutes" type="number" min={1} max={480} value={work.settings.minutes ?? ""} onChange={event => setWork({ ...work, settings: { ...work.settings, minutes: event.target.value ? Number(event.target.value) : undefined } })} /></label>
        <label>Порог прохождения, %<input name="pass" type="number" min={0} max={100} value={work.settings.pass ?? ""} onChange={event => setWork({ ...work, settings: { ...work.settings, pass: event.target.value ? Number(event.target.value) : undefined } })} /></label>
      </div>}
      <div className="library-workbench">
      <fieldset><legend>Задачи в работе · {selected.length}</legend>
        {selected.map((id, i) => {
          const item = tasks.find(entry => entry.id === id)?.data ?? work.tasks.find(entry => entry.id === id)?.task;
          return <div key={id} className="task-edit">
          <div className="split">
          <Hidden name="task" value={id} />
          <b>{i + 1}. {tasks.find(item => item.id === id)?.title ?? work.tasks.find(item => item.id === id)?.task.title}</b>
          <div className="controls">
            <button type="button" className="secondary" aria-label={"Поднять задачу " + (i + 1)} disabled={i === 0} onClick={() => setSelected(current => reorder(current, i, -1))}>↑</button>
            <button type="button" className="secondary" aria-label={"Опустить задачу " + (i + 1)} disabled={i === selected.length - 1} onClick={() => setSelected(current => reorder(current, i, 1))}>↓</button>
            <button type="button" className="plain" onClick={() => setSelected(current => current.filter(value => value !== id))}>Убрать</button>
          </div>
          </div>
          {item && <details><summary>{answerLabels[item.response ?? "file"]} · {item.max} б. · условие</summary>
            <FormattedText text={item.prompt} />
            {!!item.options?.length && <ol>{item.options.map((option, j) => <li key={j}>{option}</li>)}</ol>}
          </details>}
        </div>})}
        {!selected.length && <p className="muted">Добавьте задачи из банка. Здесь можно будет изменить их порядок.</p>}
      </fieldset>
      <fieldset><legend>Банк задач · {available.length}</legend>
        <label>Поиск по названию или теме<input type="search" value={filter} onChange={event => setFilter(event.target.value)} /></label>
        <div className="library-bank">
          {available.map(item => <article className="lesson-block" key={item.id}>
            <div className="split"><div><b>{item.title}</b><br /><small>{item.data.topic} · {answerLabels[item.data.response ?? "file"]} · {item.data.max} б.</small></div>
              <button type="button" className="secondary" aria-label={"Добавить: " + item.title} disabled={selected.length >= 48} onClick={() => setSelected(current => [...current, item.id])}>+ Добавить</button></div>
            <details><summary>Условие</summary><FormattedText text={item.data.prompt} /></details>
          </article>)}
          {!available.length && <p className="muted">{filter.trim() ? "По этому запросу задач нет." : "Доступных задач пока нет."}</p>}
        </div>
      </fieldset>
      </div>
    </>}
    {result.error && <p className="notice error" role="alert">{result.error}</p>}
    <div className="controls library-save">
      <button name="ready" value="no" className="secondary" disabled={pending}>Сохранить черновик</button>
      <button name="ready" value="yes" disabled={pending}>{pending ? "Сохранение…" : "Сохранить как готовое"}</button>
    </div>
  </form>;
}

export function PlanningEditor({ assignment, groups, items, preferredGroup }: { assignment?: Assignment; groups: Group[]; items: LibraryEntry[]; preferredGroup?: string }) {
  const [result, action, pending] = useActionState(savePlannedLesson, { error: "" });
  const moscow = assignment ? new Date(new Date(assignment.starts).getTime() + 3 * 3600000).toISOString().slice(0,16) : "";
  const [form, setForm] = useState({
    format: assignment?.settings.format ?? "online", title: assignment?.content.title ?? "", level: assignment?.level ?? "basic",
    group: assignment?.group_id ?? preferredGroup ?? "", starts: moscow, duration: assignment?.settings.duration ?? 90,
    meeting: assignment?.meeting ?? "", location: assignment?.settings.location ?? "", recording: assignment?.settings.recording ?? "",
    theory: assignment ? "keep" : "", practice: assignment ? "keep" : "", homework: assignment ? "keep" : "", assessment: assignment ? "keep" : ""
  });
  const update = (name: keyof typeof form, value: string) => setForm(current => ({ ...current, [name]: value }));
  const theory = items.filter(item => item.kind === "theory");
  const [extraTheory, setExtraTheory] = useState<string[]>([]);
  const orderedTheory = [form.theory, ...extraTheory];
  function moveTheory(index: number, step: number) {
    const [first, ...rest] = reorder(orderedTheory, index, step);
    update("theory", first);
    setExtraTheory(rest);
  }
  return <form action={action} className="editor">
    <Hidden name="id" value={assignment?.id ?? ""} />
    <div className="formgrid">
      {assignment ? <label>Группа<input value={groups.find(group => group.id === form.group)?.name ?? ""} readOnly /></label> :
        <label>Группа<select name="group" required value={form.group} onChange={event => update("group", event.target.value)}><option value="" disabled>Выберите группу</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>}
      <label>Дата и время (МСК)<input name="starts" type="datetime-local" required value={form.starts} onChange={event => update("starts", event.target.value)} /></label>
      <label>Название занятия<input name="title" placeholder="По умолчанию — название теории" maxLength={120} value={form.title} onChange={event => update("title", event.target.value)} /></label>
      <label>Уровень<select name="level" value={form.level} onChange={event => update("level", event.target.value)}><option value="basic">{levels.basic}</option><option value="advanced">{levels.advanced}</option></select></label>
      <label>Формат<select name="format" value={form.format} onChange={event => update("format", event.target.value)}>{Object.entries(formats).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Длительность, мин<input name="duration" type="number" min={5} max={480} required value={form.duration} onChange={event => update("duration", event.target.value)} /></label>
    </div>
    {form.format === "online" && <>
      <label>Ссылка на видеовстречу<input name="meeting" type="url" value={form.meeting} onChange={event => update("meeting", event.target.value)} /></label>
      <label>Ссылка на запись<input name="recording" type="url" value={form.recording} onChange={event => update("recording", event.target.value)} /></label>
    </>}
    {form.format === "offline" && <label>Место проведения<input name="location" required maxLength={300} value={form.location} onChange={event => update("location", event.target.value)} /></label>}
    <fieldset><legend>Материалы занятия</legend>
      <label>Теория<select name="theory" required value={form.theory} onChange={event => {
        const id = event.target.value;
        update("theory", id);
        setExtraTheory(current => id === "keep" ? [] : current.filter(value => value !== id));
      }}>
        <option value="" disabled>Выберите готовую теорию</option>
        {assignment && <option value="keep">Оставить текущую · {assignment.content.topic}</option>}
        {theory.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select></label>
      {form.theory && form.theory !== "keep" && <>
        {orderedTheory.map((id, i) => {
          const item = theory.find(value => value.id === id);
          return <div className="task-edit" key={id}>
            {i > 0 && <Hidden name="theory" value={id} />}
            <div className="split"><b>{i + 1}. {item?.title}</b><div className="controls">
              <button type="button" className="secondary" aria-label={"Поднять блок " + (i + 1)} disabled={i === 0} onClick={() => moveTheory(i, -1)}>↑</button>
              <button type="button" className="secondary" aria-label={"Опустить блок " + (i + 1)} disabled={i === orderedTheory.length - 1} onClick={() => moveTheory(i, 1)}>↓</button>
              {i > 0 && <button type="button" className="plain" onClick={() => setExtraTheory(extraTheory.filter(value => value !== id))}>Убрать блок</button>}
            </div></div>
            {item && <details><summary>Посмотреть содержимое</summary>
              <FormattedText text={item.data.theory} />
              {item.data.materials?.map((block, j) => <div key={j}><b>{block.title}</b><FormattedText text={block.value} /></div>)}
            </details>}
          </div>;
        })}
        <label>Добавить блок теории<select value="" disabled={extraTheory.length >= 11} onChange={event => setExtraTheory([...extraTheory, event.target.value])}>
          <option value="" disabled>Выберите ещё один блок</option>
          {theory.filter(item => item.id !== form.theory && !extraTheory.includes(item.id)).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select></label>
      </>}
      {libraryWorkKinds.map(kind => <label key={kind}>{workLabels[kind]}<select name={kind} value={form[kind]} onChange={event => update(kind, event.target.value)}>
        {assignment && <option value="keep">{assignment.content.tasks.some(task => workKind(task, false) === kind) ? "Оставить текущую работу" : "Без изменений · работы нет"}</option>}
        <option value="">Без работы</option>
        {items.filter(item => item.kind === "work" && item.data.kind === kind).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select></label>)}
      <p className="muted">Если выбрать материал заново, в занятие попадёт его текущая готовая версия.</p>
    </fieldset>
    {result.error && <p className="notice error" role="alert">{result.error}</p>}
    <button disabled={pending}>{pending ? "Сохранение…" : assignment ? "Обновить занятие" : "Назначить занятие"}</button>
  </form>;
}
