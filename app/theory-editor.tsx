"use client";

import { useState, type ReactNode } from "react";
import { TextEditor } from "./text-editor";
import type { Lesson, Material } from "../lib/model";

const blocks = { text: "Текст", definition: "Определение", example: "Разбор примера", link: "Ссылка / внешний файл" };
function move<T>(items: T[], from: number, to: number) {
  const result = [...items];
  [result[from], result[to]] = [result[to], result[from]];
  return result;
}

export function Theory({ lesson, update, modular = false }: { lesson: Lesson; update: (patch: Partial<Lesson>) => void; modular?: boolean }) {
  const materials = lesson.materials ?? [];
  const [selectedBlock, setSelectedBlock] = useState(0);
  const activeBlock = Math.min(selectedBlock, Math.max(0, materials.length - 1));
  return <div className="theory-workspace">
    <aside className="theory-insert" aria-label="Добавить блок">
      <b>Добавить блок</b>
      {Object.entries(blocks).map(([kind, label]) => <button key={kind} className="secondary" type="button" disabled={materials.length >= 32} onClick={() => {
        setSelectedBlock(materials.length);
        update({ materials: [...materials, { title: "", value: "", kind: kind as Material["kind"], phase: "before" }] });
      }}>+ {label}</button>)}
      {modular && materials.length > 0 && <nav className="theory-block-nav" aria-label="Блоки теории">{materials.map((item, index) =>
        <button key={index} type="button" className="secondary" aria-current={activeBlock === index ? "step" : undefined} onClick={() => setSelectedBlock(index)}>{index + 1}. {item.title || blocks[item.kind]}</button>
      )}</nav>}
    </aside>
    <div className="theory-content">
    {!modular && <Text label="Введение или конспект" value={lesson.theory} onChange={theory => update({ theory })} max={15000} multiline />}
    {modular && !materials.length && <p className="muted">Выберите тип блока, чтобы добавить материал.</p>}
    {materials.map((item, i) => {
      if (modular && i !== activeBlock) return null;
      const patch = (values: Partial<Material>) => update({ materials: materials.map((block, index) => index === i ? { ...block, ...values } : block) });
      return <section className="task-edit" key={i}>
        <div className="split"><b>{i + 1}. {blocks[item.kind]}</b><Order label="блок" index={i} count={materials.length}
          onMove={direction => { setSelectedBlock(i + direction); update({ materials: move(materials, i, i + direction) }); }}
          onRemove={() => update({ materials: materials.filter((_, index) => index !== i) })} /></div>
        <Text label="Заголовок блока" value={item.title} onChange={title => patch({ title })} max={120} />
        <label>Когда изучать<select value={item.phase} onChange={e => patch({ phase: e.target.value === "after" ? "after" : "before" })}><option value="before">До занятия</option><option value="after">После занятия</option></select></label>
        <Text label={item.kind === "link" ? "HTTPS-ссылка" : "Содержимое блока"} value={item.value} onChange={value => patch({ value })} max={item.kind === "link" ? 2048 : 15000} multiline={item.kind !== "link"} />
      </section>;
    })}
    </div>
  </div>;
}

function Order({ label, index, count, onMove, onRemove }: { label: string; index: number; count: number; onMove: (direction: number) => void; onRemove: () => void }) {
  return <div className="controls">
    <button type="button" className="secondary" disabled={index === 0} aria-label={"Поднять " + label} title="Переместить выше" onClick={() => onMove(-1)}>↑ Выше</button>
    <button type="button" className="secondary" disabled={index + 1 === count} aria-label={"Опустить " + label} title="Переместить ниже" onClick={() => onMove(1)}>↓ Ниже</button>
    <button type="button" className="plain" onClick={onRemove}>Удалить {label}</button>
  </div>;
}
function Text({ label, value, onChange, max, multiline = false }: { label: ReactNode; value: string; onChange: (value: string) => void; max: number; multiline?: boolean }) {
  return multiline ? <TextEditor label={label} value={value} onChange={onChange} maxLength={max} /> :
    <label>{label}<input maxLength={max} value={value} onChange={e => onChange(e.target.value)} /></label>;
}
