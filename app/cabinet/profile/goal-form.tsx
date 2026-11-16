"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import {
  goalAdmissionPlans, goalCompetitions, goalDirections, goalKinds, goalResults, profileGoalPath, type StudentGoal,
} from "../../../lib/student-goal";
import { saveStudentGoal } from "./goal-actions";

export function GoalForm({ goal, image }: { goal: StudentGoal; image: string }) {
  const [result, save, pending] = useActionState(saveStudentGoal, { error: "" });
  const [draft, setDraft] = useState(goal);

  function update<K extends keyof StudentGoal>(name: K, value: StudentGoal[K]) {
    setDraft(current => ({ ...current, [name]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    // Сохраняем заполненные поля при ошибке проверки.
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => save(form));
  }

  return <form action={save} onSubmit={submit} className="editor goal-form">
    {result.error && <p className="notice error" role="alert">{result.error}</p>}
    <div className="goal-layout">
      <div className="goal-fields">
        <fieldset className="goal-choices">
          <legend>Основная цель</legend>
          {Object.entries(goalKinds).map(([id, label], index) => <label key={id}>
            <input type="radio" name="kind" value={id} checked={draft.kind === id}
              required={index === 0} onChange={() => update("kind", id)} />
            {label}
          </label>)}
        </fieldset>
        <div className="formgrid">
          <GoalSelect name="competition" label="Целевая олимпиада" options={goalCompetitions}
            value={draft.competition} onChange={value => update("competition", value)} />
          <GoalSelect name="result" label="Желаемый результат" options={goalResults}
            value={draft.result} onChange={value => update("result", value)} />
        </div>
        {(draft.competition === "listed" || draft.competition === "other") && <label>
          Название олимпиады
          <input name="competitionName" maxLength={160} value={draft.competitionName}
            placeholder="Например, «Высшая проба»" onChange={event => update("competitionName", event.target.value)} />
        </label>}
        <label>Напоминание себе
          <textarea name="reason" rows={3} maxLength={600} placeholder="Почему для меня важна эта цель?"
            value={draft.reason} onChange={event => update("reason", event.target.value)} />
        </label>
        <label>Ближайший шаг
          <input name="nextStep" maxLength={200} placeholder="Например, решить задачи школьного этапа"
            value={draft.nextStep} onChange={event => update("nextStep", event.target.value)} />
        </label>
        <div className="goal-admission">
          <h3>Планы на поступление</h3>
          <div className="formgrid">
            <label>Целевой вуз
              <input name="university" maxLength={160} value={draft.university}
                onChange={event => update("university", event.target.value)} />
            </label>
            <GoalSelect name="admission" label="Стратегия поступления" options={goalAdmissionPlans}
              value={draft.admission} onChange={value => update("admission", value)} />
          </div>
          <fieldset className="goal-choices goal-directions">
            <legend>Интересующие направления</legend>
            {Object.entries(goalDirections).map(([id, label]) => <label key={id}>
              <input type="checkbox" name="directions" value={id} checked={draft.directions.includes(id)}
                onChange={event => update("directions", event.target.checked
                  ? [...draft.directions, id] : draft.directions.filter(direction => direction !== id))} />
              {label}
            </label>)}
          </fieldset>
        </div>
      </div>
      <GoalImageInput image={image} pending={pending} />
    </div>
    <div className="controls goal-actions">
      <button disabled={pending}>{pending ? "Сохраняем…" : "Сохранить цель"}</button>
      <Link className="button secondary" href={profileGoalPath}>Отмена</Link>
    </div>
  </form>;
}

function GoalImageInput({ image, pending }: { image: string; pending: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLButtonElement>(null);
  const [preview, setPreview] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const source = preview || (removeImage ? "" : image);

  useEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function remove() {
    if (input.current) input.current.value = "";
    setPreview("");
    setRemoveImage(true);
    picker.current?.focus();
  }

  return <figure className="goal-visual">
    <figcaption>Визуализация цели</figcaption>
    <input ref={input} hidden type="file" name="image" aria-label="Изображение цели"
      accept="image/jpeg,image/png,image/webp" onChange={event => {
        const file = event.currentTarget.files?.[0];
        setPreview(file ? URL.createObjectURL(file) : "");
        if (file) setRemoveImage(false);
      }} />
    {removeImage && <input type="hidden" name="removeImage" value="on" />}
    <button ref={picker} type="button" className={source ? "goal-image goal-image-picker" : "secondary"}
      aria-label={source ? "Заменить изображение цели" : undefined} disabled={pending}
      onClick={() => input.current?.click()}>
      {source ? <img src={source} alt="Предпросмотр изображения цели" /> : "Выбрать файл"}
    </button>
    {source && <div className="goal-image-actions">
      <button type="button" className="plain" disabled={pending} onClick={remove}>Удалить изображение</button>
    </div>}
  </figure>;
}

function GoalSelect({ name, label, options, value, onChange }: {
  name: string;
  label: string;
  options: Readonly<Record<string, string>>;
  value: string;
  onChange: (value: string) => void;
}) {
  return <label>{label}
    <select name={name} value={value} onChange={event => onChange(event.target.value)}>
      <option value="">Пока не выбрано</option>
      {Object.entries(options).map(([id, text]) => <option key={id} value={id}>{text}</option>)}
    </select>
  </label>;
}
