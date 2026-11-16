"use client";

import { useId, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ru } from "react-day-picker/locale";
import { InterfaceIcon } from "./interface-icons";
import "react-day-picker/style.css";
import "./date-field.css";

const moscowDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit"
});
const twoDigits = (number: number) => String(number).padStart(2, "0");
const hours = Array.from({ length: 24 }, (_, index) => twoDigits(index));
const minutes = Array.from({ length: 60 }, (_, index) => twoDigits(index));

function calendarDate(value: string) {
  return new Date(value + "T12:00");
}

function dateValue(date: Date) {
  return [String(date.getFullYear()).padStart(4, "0"), twoDigits(date.getMonth() + 1), twoDigits(date.getDate())].join("-");
}

export function DateField({ label, name, withTime = false, defaultValue, value, onChange }: {
  label: string;
  name: string;
  withTime?: boolean;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<{ date: string; today: string; hour: string; minute: string }>();

  function openCalendar() {
    const [date = "", time = "00:00"] = (field.current?.value ?? "").split("T");
    const [hour, minute] = time.split(":");
    setDraft({ date, today: moscowDate.format(new Date()), hour, minute });
    dialog.current?.showModal();
  }

  function applyDate() {
    if (!draft?.date || !field.current) return;
    const next = draft.date + (withTime ? "T" + draft.hour + ":" + draft.minute : "");
    if (value === undefined) field.current.value = next;
    onChange?.(next);
    dialog.current?.close();
  }

  return <div className="date-field">
    <label htmlFor={id}>{label}</label>
    <div className="date-field-input">
      <input ref={field} id={id} name={name} type={withTime ? "datetime-local" : "date"} required
        defaultValue={defaultValue} value={value} onChange={event => onChange?.(event.target.value)} />
      <button type="button" className="date-field-trigger" aria-label={"Открыть календарь · " + label}
        aria-haspopup="dialog" onClick={openCalendar}><InterfaceIcon name="schedule" /></button>
    </div>
    <dialog ref={dialog} className="date-field-dialog" aria-labelledby={id + "-title"} onClose={() => setDraft(undefined)}>
      <h2 id={id + "-title"}>{withTime ? "Дата и время (МСК)" : "Выберите дату"}</h2>
      {draft && <>
        <DayPicker mode="single" required autoFocus locale={ru} today={calendarDate(draft.today)}
          labels={{
            labelNav: () => "Навигация по месяцам",
            labelPrevious: () => "Предыдущий месяц",
            labelNext: () => "Следующий месяц"
          }}
          selected={draft.date ? calendarDate(draft.date) : undefined}
          defaultMonth={calendarDate(draft.date || draft.today)}
          onSelect={date => setDraft({ ...draft, date: dateValue(date) })} />
        {withTime && <div className="date-field-time">
          <label>Часы<select value={draft.hour} onChange={event => setDraft({ ...draft, hour: event.target.value })}>
            {hours.map(hour => <option key={hour}>{hour}</option>)}
          </select></label>
          <label>Минуты<select value={draft.minute} onChange={event => setDraft({ ...draft, minute: event.target.value })}>
            {minutes.map(minute => <option key={minute}>{minute}</option>)}
          </select></label>
        </div>}
        <div className="date-field-actions">
          <button type="button" className="secondary" onClick={() => dialog.current?.close()}>Отмена</button>
          <button type="button" disabled={!draft.date} onClick={applyDate}>Выбрать</button>
        </div>
      </>}
    </dialog>
  </div>;
}
