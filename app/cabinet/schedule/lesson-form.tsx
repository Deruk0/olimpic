"use client";

import { useActionState, useState } from "react";
import { formats, type LessonSettings } from "../../../lib/model";
import { DateField } from "../../date-field";
import { Hidden, Submit } from "../../components";
import { saveLesson } from "../teacher-actions";

type LessonDraft = {
  id?: string; student: string; title: string; theory: string; starts: string;
  duration: string; format: LessonSettings["format"]; location: string;
};

export function LessonForm({ initial, studentName, students, theories }: {
  initial: LessonDraft;
  studentName?: string;
  students: { id: string; name: string }[];
  theories: { id: string; title: string }[];
}) {
  const [draft, setDraft] = useState(initial);
  const [result, action] = useActionState(saveLesson, { error: "" });
  const change = (patch: Partial<LessonDraft>) => setDraft(current => ({ ...current, ...patch }));
  return <form className="editor" action={action}>
    {draft.id ? <><Hidden name="id" value={draft.id} /><p className="muted">{studentName}</p></> :
      <label>Ученик<select name="student" value={draft.student} onChange={event => change({ student: event.target.value })} required>
        <option value="">Выберите ученика</option>{students.map(student => <option value={student.id} key={student.id}>{student.name}</option>)}
      </select></label>}
    <label>Название урока<input name="title" required maxLength={120} value={draft.title} onChange={event => change({ title: event.target.value })} /></label>
    {!draft.id && <label>Готовая теория<select name="theory" value={draft.theory} onChange={event => change({ theory: event.target.value })}>
      <option value="">Без теории</option>{theories.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}
    </select></label>}
    <div className="formgrid">
      <DateField name="starts" label="Дата и время (МСК)" withTime value={draft.starts} onChange={starts => change({ starts })} />
      <label>Длительность, мин<input name="duration" type="number" min={5} max={480} required value={draft.duration} onChange={event => change({ duration: event.target.value })} /></label>
    </div>
    <div className="formgrid">
      <label>Формат<select name="format" value={draft.format} onChange={event => change({ format: event.target.value as LessonDraft["format"] })}>
        {Object.entries(formats).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      {draft.format === "offline" && <label>Место очного урока<input name="location" maxLength={300}
        required value={draft.location} onChange={event => change({ location: event.target.value })} /></label>}
    </div>
    {result.error && <p className="notice error" role="alert">{result.error}</p>}
    <Submit>{draft.id ? "Сохранить урок" : "Назначить урок"}</Submit>
  </form>;
}
