"use client";

import { useActionState, useState, type ReactNode } from "react";
import { saveProgram } from "./actions";
import { Hidden } from "./components";
import { TextEditor } from "./text-editor";
import { FormattedText } from "./formatted-text";
import type { Lesson, Material, Program, ProgramKey, Task, WorkKind, WorkSettings } from "../lib/model";
import { workKind, workLabels } from "../lib/work";

type Tab = "info" | "theory" | WorkKind;
const tabs = { info: "Общее", theory: "Теория", ...workLabels };
const blocks = { text: "Текст", definition: "Определение", example: "Разбор примера", link: "Ссылка / внешний файл" };
const emptyLesson = (): Lesson => ({ title: "", topic: "", theory: "", tasks: [], materials: [] });
function move<T>(items: T[], from: number, to: number) {
  const result = [...items];
  [result[from], result[to]] = [result[to], result[from]];
  return result;
}

export function ProgramEditor({ level, initial }: { level: ProgramKey; initial: Program }) {
  const diagnostic = level === "diagnostic";
  const [program, setProgram] = useState(initial);
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<Tab>("info");
  const [preview, setPreview] = useState(false);
  const [result, dispatch, pending] = useActionState(saveProgram, { message: "", error: false });
  const lesson = program.lessons[selected];
  const update = (values: Partial<Lesson>) => setProgram(current => ({
    ...current, lessons: current.lessons.map((item, index) => index === selected ? { ...item, ...values } : item)
  }));
  const setting = (kind: WorkKind, values: WorkSettings) => {
    if (lesson) update({ work: { ...lesson.work, [kind]: { ...lesson.work?.[kind], ...values } } });
  };
  const sections: Tab[] = diagnostic ? ["info", "diagnostic"] : ["info", "theory", "practice", "homework", "assessment"];
  function changeLesson(index: number) { setSelected(index); setPreview(false); }
  return <form action={dispatch} className="editor program-builder">
    <Hidden name="level" value={level} /><Hidden name="program" value={JSON.stringify(program)} />
    <fieldset className="builder-fields" disabled={pending}>
      <div className="formgrid">
        <Text label="Целевая олимпиада" value={program.olympiad} onChange={olympiad => setProgram({ ...program, olympiad })} max={120} />
        {diagnostic && <>
          <Num label="Порог продвинутого уровня, %" value={program.advanced} onChange={advanced => setProgram({ ...program, advanced: advanced ?? 70 })} />
          <Num label="Порог приоритетной темы, %" value={program.priority} onChange={priority => setProgram({ ...program, priority: priority ?? 60 })} />
        </>}
      </div>
      <div className="builder-layout">
        <aside className="builder-lessons" aria-label="Занятия программы">
          <b>{diagnostic ? "Входная диагностика" : "Занятия программы"}</b>
          {program.lessons.map((item, i) => <button className={selected === i ? "" : "secondary"} type="button" key={i} aria-pressed={selected === i} onClick={() => changeLesson(i)}>{i + 1}. {item.title || "Без названия"}</button>)}
          <button className="secondary" type="button" disabled={program.lessons.length >= (diagnostic ? 1 : 30)} onClick={() => {
            setProgram({ ...program, lessons: [...program.lessons, emptyLesson()] }); changeLesson(program.lessons.length); setTab("info");
          }}>{diagnostic ? "+ Комплект диагностики" : "+ Занятие"}</button>
        </aside>
        <div className="builder-workspace">
          {!lesson ? <p className="muted">Добавьте занятие, чтобы начать настройку.</p> : <>
            <div className="controls builder-tabs" aria-label="Разделы занятия">
              {sections.map(section => <button key={section} className={tab === section ? "" : "secondary"} type="button" aria-pressed={tab === section} onClick={() => { setTab(section); setPreview(false); }}>{tabs[section]}</button>)}
            </div>
            {tab === "info" ? <>
              <div className="formgrid">
                <Text label="Название занятия" value={lesson.title} onChange={title => update({ title })} max={120} />
                <Text label="Тема занятия" value={lesson.topic} onChange={topic => update({ topic })} max={100} />
              </div>
              <Order label="занятие" index={selected} count={program.lessons.length}
                onMove={direction => { setProgram({ ...program, lessons: move(program.lessons, selected, selected + direction) }); changeLesson(selected + direction); }}
                onRemove={() => { if (!window.confirm("Удалить занятие из черновика?")) return; setProgram({ ...program, lessons: program.lessons.filter((_, i) => i !== selected) }); changeLesson(Math.max(0, selected - 1)); }} />
            </> : <>
              <div className="split"><h2>{tabs[tab]}</h2><button type="button" className="secondary" aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? "К редактированию" : "Предпросмотр"}</button></div>
              {preview ? <Preview lesson={lesson} tab={tab} /> : tab === "theory" ? <Theory lesson={lesson} update={update} /> : <>
                <Text label="Инструкция ученику" value={lesson.work?.[tab]?.instructions ?? (tab === "diagnostic" ? lesson.theory : "")}
                  onChange={instructions => setting(tab, { instructions })} max={5000} multiline />
                {tab === "assessment" && <div className="formgrid">
                  <Num label="Рекомендуемое время, мин" value={lesson.work?.assessment?.minutes} max={480} onChange={minutes => setting(tab, { minutes })} />
                  <Num label="Порог прохождения, %" value={lesson.work?.assessment?.pass} min={0} onChange={pass => setting(tab, { pass })} />
                </div>}
                {tab === "homework" && <Num label="Срок после занятия, дней (необязательно)" value={lesson.work?.homework?.dueDays} max={90} onChange={dueDays => setting(tab, { dueDays })} />}
                <TaskEditor lesson={lesson} kind={tab} update={update} />
              </>}
            </>}
          </>}
        </div>
      </div>
    </fieldset>
    {result.message && <p className={result.error ? "notice error" : "notice"} role={result.error ? "alert" : "status"}>{result.message}</p>}
    <div className="controls"><button className="secondary" name="publish" value="no" disabled={pending}>Сохранить черновик</button><button name="publish" value="yes" disabled={pending}>{pending ? "Сохранение…" : "Опубликовать"}</button></div>
  </form>;
}

export function Theory({ lesson, update }: { lesson: Lesson; update: (patch: Partial<Lesson>) => void }) {
  const materials = lesson.materials ?? [];
  return <div className="theory-workspace">
    <aside className="theory-insert" aria-label="Добавить блок">
      <b>Блоки</b>
      {Object.entries(blocks).map(([kind, label]) => <button key={kind} className="secondary" type="button" disabled={materials.length >= 32} onClick={() => update({ materials: [...materials, { title: "", value: "", kind: kind as Material["kind"], phase: "before" }] })}>+ {label}</button>)}
    </aside>
    <div className="theory-content">
    <Text label="Введение или конспект" value={lesson.theory} onChange={theory => update({ theory })} max={15000} multiline />
    {materials.map((item, i) => {
      const patch = (values: Partial<Material>) => update({ materials: materials.map((block, index) => index === i ? { ...block, ...values } : block) });
      return <section className="task-edit" key={i}>
        <div className="split"><b>{i + 1}. {blocks[item.kind]}</b><Order label="блок" index={i} count={materials.length}
          onMove={direction => update({ materials: move(materials, i, i + direction) })}
          onRemove={() => update({ materials: materials.filter((_, index) => index !== i) })} /></div>
        <Text label="Заголовок блока" value={item.title} onChange={title => patch({ title })} max={120} />
        <label>Когда изучать<select value={item.phase} onChange={e => patch({ phase: e.target.value === "after" ? "after" : "before" })}><option value="before">До занятия</option><option value="after">После занятия</option></select></label>
        <Text label={item.kind === "link" ? "HTTPS-ссылка" : "Содержимое блока"} value={item.value} onChange={value => patch({ value })} max={item.kind === "link" ? 2048 : 15000} multiline={item.kind !== "link"} />
      </section>;
    })}
    </div>
  </div>;
}

function TaskEditor({ lesson, kind, update }: { lesson: Lesson; kind: WorkKind; update: (patch: Partial<Lesson>) => void }) {
  const tasks = lesson.tasks.flatMap((task, index) => workKind(task, kind === "diagnostic") === kind ? [{ task, index }] : []);
  return <>
    {tasks.map(({ task, index }, position) => {
      const patch = (values: Partial<Task>) => update({ tasks: lesson.tasks.map((item, i) => i === index ? { ...item, ...values } : item) });
      return <section key={index} className="task-edit">
        <div className="split"><b>Задача {position + 1}</b><Order label="задачу" index={position} count={tasks.length}
          onMove={direction => update({ tasks: move(lesson.tasks, index, tasks[position + direction].index) })}
          onRemove={() => update({ tasks: lesson.tasks.filter((_, i) => i !== index) })} /></div>
        <div className="formgrid">
          <Text label="Название задачи" value={task.title} onChange={title => patch({ title })} max={120} />
          <Text label="Проверяемая тема" value={task.topic} onChange={topic => patch({ topic })} max={100} />
          <Num label="Максимум баллов" value={task.max} onChange={max => patch({ max: max ?? 1 })} />
          {kind !== "diagnostic" && <label>Раздел задачи<select value={kind} onChange={e => patch({ kind: e.target.value as WorkKind })}>
            <option value="practice">Практика</option><option value="homework">Домашняя работа</option><option value="assessment">Самостоятельная работа</option>
          </select></label>}
        </div>
        <Text label="Условие" value={task.prompt} onChange={prompt => patch({ prompt })} max={5000} multiline />
        {kind === "practice" && <>
          <Text label="Подсказка (необязательно)" value={task.hint ?? ""} onChange={hint => patch({ hint })} max={3000} multiline />
          <Text label="Разбор для самопроверки (необязательно)" value={task.solution ?? ""} onChange={solution => patch({ solution })} max={6000} multiline />
        </>}
        <Text label="Критерии проверки · только для куратора" value={task.rubric ?? ""} onChange={rubric => patch({ rubric })} max={5000} multiline />
      </section>;
    })}
    <button type="button" className="secondary" disabled={lesson.tasks.length >= 48} onClick={() => update({ tasks: [...lesson.tasks, { title: "", topic: lesson.topic, prompt: "", max: 5, kind }] })}>+ Задача</button>
  </>;
}

function Preview({ lesson, tab }: { lesson: Lesson; tab: Exclude<Tab, "info"> }) {
  if (tab === "theory") return <div className="lesson-section">
    <FormattedText text={lesson.theory} />
    {lesson.materials?.map((material, i) => <div key={i} className="lesson-block"><b>{material.title || blocks[material.kind]}</b><FormattedText text={material.value} /></div>)}
    {!lesson.theory && !lesson.materials?.length && <p className="muted">Блоков теории пока нет.</p>}
  </div>;
  const items = lesson.tasks.filter(task => workKind(task, tab === "diagnostic") === tab);
  const settings = lesson.work?.[tab];
  return <div className="lesson-section">
    <FormattedText text={settings?.instructions ?? (tab === "diagnostic" ? lesson.theory : "")} />
    {settings?.dueDays !== undefined && <p>Срок после занятия · {settings.dueDays} дн.</p>}
    {settings?.minutes !== undefined && <p>Рекомендуемое время · {settings.minutes} мин</p>}
    {settings?.pass !== undefined && <p>Порог · {settings.pass}%</p>}
    {items.map((task, i) => <div key={i} className="lesson-block"><b>{task.title || "Задача " + (i + 1)} · {task.max} б.</b><FormattedText text={task.prompt} />
      {tab === "practice" && task.hint && <details><summary>Подсказка</summary><FormattedText text={task.hint} /></details>}
      {tab === "practice" && task.solution && <details><summary>Разбор</summary><FormattedText text={task.solution} /></details>}
    </div>)}
    {!items.length && <p className="muted">Задач в этом разделе пока нет.</p>}
  </div>;
}
function Order({ label, index, count, onMove, onRemove }: { label: string; index: number; count: number; onMove: (direction: number) => void; onRemove: () => void }) {
  return <div className="controls">
    <button type="button" className="secondary" disabled={index === 0} aria-label={"Поднять " + label} onClick={() => onMove(-1)}>↑</button>
    <button type="button" className="secondary" disabled={index + 1 === count} aria-label={"Опустить " + label} onClick={() => onMove(1)}>↓</button>
    <button type="button" className="plain" onClick={onRemove}>Удалить {label}</button>
  </div>;
}
function Text({ label, value, onChange, max, multiline = false }: { label: ReactNode; value: string; onChange: (value: string) => void; max: number; multiline?: boolean }) {
  return multiline ? <TextEditor label={label} value={value} onChange={onChange} maxLength={max} /> :
    <label>{label}<input maxLength={max} value={value} onChange={e => onChange(e.target.value)} /></label>;
}
function Num({ label, value, onChange, min = 1, max = 100 }: { label: string; value?: number; onChange: (value?: number) => void; min?: number; max?: number }) {
  return <label>{label}<input type="number" min={min} max={max} value={value ?? ""} onChange={e => onChange(e.target.value ? Number(e.target.value) : undefined)} /></label>;
}
