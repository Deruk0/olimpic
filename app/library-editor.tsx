"use client";

import { useActionState, useRef, useState } from "react";
import { Hidden } from "./components";
import { deleteLibrary, saveLibrary, savePlannedLesson } from "./library-actions";
import { Theory } from "./program-editor";
import { TextEditor } from "./text-editor";
import { TaskAnswerInputs, TaskOptionList } from "./task-answer";
import { FormattedText } from "./formatted-text";
import { libraryWorkKinds, type LibraryEntry, type LibraryKind, type LibraryTask, type LibraryWorkKind, type OptionalTaskSection, type TheoryOption } from "../lib/library";
import { levels, type Assignment, type Group, type Lesson, type Task } from "../lib/model";
import { workKind, workLabels } from "../lib/work";

type BankTask = Extract<LibraryEntry, { kind: "task" }>;
const answerLabels = { file: "Файл", text: "Письменный ответ", single: "Один вариант", multiple: "Несколько вариантов" };
function reorder(items: string[], index: number, step: number) {
  const next = [...items];
  [next[index], next[index + step]] = [next[index + step], next[index]];
  return next;
}

export function LibraryEditor({ kind, entry, tasks, theories }: { kind: LibraryKind; entry?: LibraryEntry; tasks: BankTask[]; theories: TheoryOption[] }) {
  const [result, action, pending] = useActionState(saveLibrary, { error: "" });
  const [title, setTitle] = useState(entry?.title ?? "");
  const [theory, setTheory] = useState<Lesson>({ title: "", topic: "", theory: "", materials: [], ...(entry?.kind === "theory" ? entry.data : {}), tasks: [] });
  const [task, setTask] = useState<LibraryTask>(entry?.kind === "task" ? entry.data : { title: "", topic: "", prompt: "", max: 5, response: "text" });
  const options = task.options?.length ? task.options : ["", ""];
  const correct = task.correct ?? [];
  const [optionKeys, setOptionKeys] = useState(() => options.map((_, index) => index));
  const nextOptionKey = useRef(options.length);
  const preview = useRef<HTMLDialogElement>(null);
  const [practicePreview, setPracticePreview] = useState(false);
  const [work, setWork] = useState(entry?.kind === "work" ? entry.data : { title: "", kind: "homework" as LibraryWorkKind, tasks: [], settings: {} });
  const [selected, setSelected] = useState(work.tasks.map(item => item.id));
  const [filter, setFilter] = useState("");
  const [module, setModule] = useState("info");
  const [started, setStarted] = useState(false);
  const [metadataError, setMetadataError] = useState("");
  const topic = kind === "task" ? task.topic : kind === "theory" ? theory.topic : work.topic ?? "";
  const modules = kind === "theory" ? [
    ["intro", "Конспект"], ["blocks", "Блоки теории"]
  ] : kind === "task" ? [
    ["prompt", "Условие"], ["answer", "Ответ и баллы"], ["hint", "Подсказка"],
    ["solution", "Разбор"], ["modelAnswer", "Образец решения"], ["rubric", "Критерии"]
  ] : [["instructions", "Инструкция"], ["tasks", "Задачи и порядок"], ["settings", "Тип и сроки"]];
  function confirmMetadata() {
    if (!title.trim() || !topic.trim()) {
      setMetadataError("Заполните название и тему.");
      return;
    }
    setMetadataError("");
    setStarted(true);
    setModule(modules[0][0]);
  }
  const available = tasks.filter(item => !selected.includes(item.id) && (item.title + " " + item.data.topic).toLowerCase().includes(filter.trim().toLowerCase()));
  const taskText = (name: "topic" | "prompt" | OptionalTaskSection, label: string, max: number) =>
    name === "topic" ? <label>{label}<input name={name} maxLength={max} value={task.topic} onChange={event => setTask({ ...task, topic: event.target.value })} /></label> :
      <TextEditor label={label} name={name} maxLength={max} value={task[name] ?? ""} onChange={value => setTask(current => ({ ...current, [name]: value }))} />;
  const hiddenSections = task.hiddenSections ?? [];
  const optionalSection = (name: OptionalTaskSection, label: string, max: number) => {
    const hidden = hiddenSections.includes(name);
    return <div className="task-builder-optional">
      <label className="task-builder-toggle"><input type="checkbox" checked={!hidden} onChange={event => {
        const enabled = event.target.checked;
        setTask(current => {
          const sections = current.hiddenSections ?? [];
          return { ...current, hiddenSections: enabled ? sections.filter(section => section !== name) : [...sections, name] };
        });
      }} />{label}</label>
      {hidden ? <><Hidden name={"hide." + name} value="1" /><Hidden name={name} value={task[name] ?? ""} /></> :
        taskText(name, "Содержимое", max)}
    </div>;
  };
  const visibleHint = !hiddenSections.includes("hint") && task.hint;
  const visibleSolution = !hiddenSections.includes("solution") && task.solution;
  return <><form className={kind === "task" ? "editor library-editor task-builder" : "editor library-editor"} action={action} noValidate onSubmit={event => {
    if (!started) { event.preventDefault(); confirmMetadata(); }
  }}>
    <Hidden name="kind" value={kind} /><Hidden name="id" value={entry?.id ?? ""} />
    <nav className="library-module-nav" aria-label="Разделы редактора">
      <button type="button" className={module === "info" ? "is-current" : ""} aria-current={module === "info" ? "step" : undefined} onClick={() => setModule("info")}>1. Название и тема</button>
      {modules.map(([id, label], index) => <button key={id} type="button" disabled={!started} className={module === id ? "is-current" : ""} aria-current={module === id ? "step" : undefined} onClick={() => setModule(id)}>{index + 2}. {label}</button>)}
    </nav>
    <section className="library-module-info" hidden={module !== "info"}>
      <h3>Название и тема</h3>
      <label>Название<input name="title" maxLength={120} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label>Тема<input name={kind === "theory" ? undefined : "topic"} maxLength={100} value={topic} onChange={event => {
        const value = event.target.value;
        if (kind === "task") setTask(current => ({ ...current, topic: value }));
        else if (kind === "theory") setTheory(current => ({ ...current, topic: value }));
        else setWork(current => ({ ...current, topic: value }));
      }} /></label>
      {metadataError && <p className="notice error" role="alert">{metadataError}</p>}
      <button type="button" onClick={confirmMetadata}>Подтвердить и продолжить</button>
    </section>
    {started && <div className="library-modules">
    <div className="library-module-heading" hidden={module === "info"}><h3>{modules.find(([id]) => id === module)?.[1]}</h3><small>{title} · {topic}</small></div>
    {kind === "theory" && <>
      <Hidden name="theory" value={JSON.stringify(theory)} />
      <div hidden={module !== "intro"}><TextEditor label="Введение или конспект" maxLength={15000} value={theory.theory} onChange={value => setTheory(current => ({ ...current, theory: value }))} /></div>
      <div hidden={module !== "blocks"}><Theory modular lesson={theory} update={patch => setTheory(current => ({ ...current, ...patch }))} /></div>
    </>}
    {kind === "task" && <div className="task-builder-main">
      <fieldset hidden={module !== "prompt"} className="task-builder-section"><legend>Условие</legend>
        <label>Связанная теория<select name="theoryId" value={task.theoryId ?? ""} onChange={event => setTask({ ...task, theoryId: event.target.value })}>
          <option value="">Не выбрана</option>
          {task.theoryId && !theories.some(theory => theory.id === task.theoryId) && <option value={task.theoryId}>Теория недоступна — выберите другую</option>}
          {theories.map(theory => <option key={theory.id} value={theory.id}>{theory.title || "Без названия"}{theory.topic ? " · " + theory.topic : ""}</option>)}
        </select><small>Название выбранной теории будет видно в банке задач.</small></label>
        {taskText("prompt", "Условие", 5000)}
      </fieldset>
      <fieldset hidden={module !== "answer"} className="task-builder-section"><legend>Ответ и оценка</legend>
      <div className="formgrid"><label>Формат ответа<select name="response" value={task.response ?? "file"} onChange={event => setTask({ ...task, response: event.target.value as Task["response"], correct: [] })}>
        <option value="text">Письменный ответ</option><option value="single">Один вариант</option><option value="multiple">Несколько вариантов</option><option value="file">Файл с решением</option>
      </select></label>
      <label>Максимум баллов<input name="max" type="number" min={1} max={100} required value={task.max} onChange={event => setTask({ ...task, max: Number(event.target.value) })} /></label></div>
      {(task.response === "single" || task.response === "multiple") && <fieldset><legend>Варианты и ключ для куратора</legend>
        {options.map((option, i) => <div className="task-builder-option" key={optionKeys[i]}>
          <div className="split">
            <label className="task-builder-key"><input type={task.response === "single" ? "radio" : "checkbox"} name="correct" value={i} checked={correct.includes(i)} onChange={event => setTask({ ...task, correct: task.response === "single" ? [i] : event.target.checked ? [...correct, i] : correct.filter(j => j !== i) })} /> Правильный вариант {i + 1}</label>
            <button className="plain" type="button" disabled={options.length <= 2} onClick={() => {
              setOptionKeys(keys => keys.filter((_, j) => j !== i));
              setTask({ ...task, options: options.filter((_, j) => j !== i), correct: correct.filter(j => j !== i).map(j => j > i ? j - 1 : j) });
            }}>Удалить вариант</button>
          </div>
          <TextEditor label={"Содержимое варианта " + (i + 1)} name="option" rows={2} maxLength={500} value={option} onChange={value => {
            setTask(current => ({ ...current, options: (current.options?.length ? current.options : options).map((item, j) => j === i ? value : item) }));
          }} />
        </div>)}
        <button className="secondary" type="button" disabled={options.length >= 12} onClick={() => {
          setOptionKeys([...optionKeys, nextOptionKey.current++]);
          setTask({ ...task, options: [...options, ""] });
        }}>+ Вариант</button>
      </fieldset>}
      </fieldset>
      <div hidden={!(["hint", "solution", "modelAnswer", "rubric"].includes(module))}>
      {module === "hint" && optionalSection("hint", "Подсказка для практики", 3000)}
      {module === "solution" && optionalSection("solution", "Разбор для самопроверки в практике", 6000)}
      {module === "modelAnswer" && optionalSection("modelAnswer", "Образец решения · только для куратора", 8000)}
      {module === "rubric" && optionalSection("rubric", "Критерии проверки · только для куратора", 5000)}
      </div>
      {(["hint", "solution", "modelAnswer", "rubric"] as OptionalTaskSection[]).filter(name => name !== module).map(name => <span key={name}>
        <Hidden name={name} value={task[name] ?? ""} />
        {hiddenSections.includes(name) && <Hidden name={"hide." + name} value="1" />}
      </span>)}
    </div>}
    {kind === "work" && <>
      <div hidden={module !== "settings"}>
      <label>Тип работы<select name="workKind" value={work.kind} onChange={event => setWork({ ...work, kind: event.target.value as LibraryWorkKind })}>{libraryWorkKinds.map(item => <option key={item} value={item}>{workLabels[item]}</option>)}</select></label>

      {work.kind === "homework" && <label>Срок после занятия, дней<input name="dueDays" type="number" min={1} max={90} value={work.settings.dueDays ?? ""} onChange={event => setWork({ ...work, settings: { ...work.settings, dueDays: event.target.value ? Number(event.target.value) : undefined } })} /></label>}
      {work.kind === "assessment" && <div className="formgrid">
        <label>Рекомендуемое время, мин<input name="minutes" type="number" min={1} max={480} value={work.settings.minutes ?? ""} onChange={event => setWork({ ...work, settings: { ...work.settings, minutes: event.target.value ? Number(event.target.value) : undefined } })} /></label>
        <label>Порог прохождения, %<input name="pass" type="number" min={0} max={100} value={work.settings.pass ?? ""} onChange={event => setWork({ ...work, settings: { ...work.settings, pass: event.target.value ? Number(event.target.value) : undefined } })} /></label>
      </div>}
      </div>
      <div hidden={module !== "instructions"}>
      <TextEditor label="Инструкция" name="instructions" maxLength={5000} value={work.settings.instructions ?? ""} onChange={instructions => setWork({ ...work, settings: { ...work.settings, instructions } })} />
      </div>
      <div hidden={module !== "tasks"} className="library-workbench">
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
            <button type="button" className="plain" onClick={() => setSelected(current => current.filter(value => value !== id))}>Убрать из работы</button>
          </div>
          </div>
          {item && <details><summary>{answerLabels[item.response ?? "file"]} · {item.max} б. · условие</summary>
            <FormattedText text={item.prompt} />
            {!!item.options?.length && <TaskOptionList task={item} indexes={item.options.map((_, i) => i)} />}
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
    </div>}
    {result.error && <p className="notice error" role="alert">{result.error}</p>}
    {started && <>
    <p className="muted form-hint">Черновик можно дописать позже. Готовый материал доступен для назначения в занятия.</p>
    <div className="controls library-save">
      {kind === "task" && <button type="button" className="secondary" onClick={() => preview.current?.showModal()}>Предпросмотр ученика</button>}
      <button name="ready" value="no" className="secondary" disabled={pending}>Сохранить черновик</button>
      <button name="ready" value="yes" disabled={pending}>{pending ? "Сохранение…" : entry?.ready ? "Сохранить изменения" : "Сохранить как готовое"}</button>
    </div>
    </>}
  </form>
  {kind === "task" && <dialog className="task-preview-dialog" ref={preview} aria-labelledby="task-preview-title">
    <div className="split">
      <p className="eyebrow" id="task-preview-title">Предпросмотр ученика</p>
      <button type="button" className="secondary" onClick={() => preview.current?.close()}>Закрыть</button>
    </div>
    <div className="editor">
      {(visibleHint || visibleSolution) && <label className="task-preview-mode"><input type="checkbox" checked={practicePreview} onChange={event => setPracticePreview(event.target.checked)} /> Показать как в практике</label>}
      <fieldset className="lesson-task">
        <legend>1. {title || "Название задачи"} · {task.max} б.</legend>
        <FormattedText text={task.prompt || "Здесь появится условие."} />
        {practicePreview && visibleHint && <details><summary>Подсказка</summary><FormattedText text={visibleHint} /></details>}
        {practicePreview && visibleSolution && <details><summary>Разбор для самопроверки</summary><FormattedText text={visibleSolution} /></details>}
        <TaskAnswerInputs task={{ ...task, title: title || "Название задачи", options }} index={0} />
      </fieldset>
    </div>
  </dialog>}
  </>;
}

export function DeleteLibraryItem({ entry }: { entry: LibraryEntry }) {
  const [result, action, pending] = useActionState(deleteLibrary, { error: "" });
  return <details className="material danger-zone">
    <summary>Удалить из библиотеки</summary>
    <p>Удалить «{entry.title || "Без названия"}»? Назначенные занятия сохранят свои материалы.
      {entry.kind === "task" && " В уже собранных работах останется сохранённая копия задачи."}</p>
    <form action={action}>
      <Hidden name="id" value={entry.id} /><Hidden name="kind" value={entry.kind} />
      {result.error && <p className="notice error" role="alert">{result.error}</p>}
      <button className="plain" disabled={pending}>{pending ? "Удаление…" : "Подтвердить удаление"}</button>
    </form>
  </details>;
}

export function PlanningEditor({ assignment, groups, items, preferredGroup }: { assignment?: Assignment; groups: Group[]; items: LibraryEntry[]; preferredGroup?: string }) {
  const [result, action, pending] = useActionState(savePlannedLesson, { error: "" });
  const [form, setForm] = useState({
    title: assignment?.content.title ?? "", level: assignment?.level ?? "basic",
    group: assignment?.group_id ?? preferredGroup ?? "",
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
      <label>Название занятия<input name="title" placeholder="По умолчанию — название теории" maxLength={120} value={form.title} onChange={event => update("title", event.target.value)} /></label>
      <label>Уровень<select name="level" value={form.level} onChange={event => update("level", event.target.value)}><option value="basic">{levels.basic}</option><option value="advanced">{levels.advanced}</option></select></label>
    </div>
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
