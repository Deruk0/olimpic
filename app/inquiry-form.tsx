"use client";

import { useActionState, useState } from "react";
import { submitInquiry, type InquiryResult } from "./inquiry-action";
import styles from "./school-journey.module.css";

const initial: InquiryResult = { status: "idle", message: "" };

export function InquiryForm({ policyUrl }: { policyUrl?: string }) {
  const [result, action, pending] = useActionState(submitInquiry, initial);
  const [fields, setFields] = useState({ name: "", grade: "", phone: "", email: "", consent: false });

  if (result.status === "success") return <div className={styles.form} role="status">
    <h3>Заявка принята</h3>
    <p>{result.message}</p>
  </div>;

  return <form action={action} className={styles.form} aria-labelledby="inquiry-form-title">
    <h3 id="inquiry-form-title">Оставить заявку</h3>
    <p className={styles.formHint}>Укажите хотя бы один контакт для связи.</p>
    <div className={styles.fields}>
      <label>Ваше имя
        <input name="name" autoComplete="given-name" maxLength={80} required value={fields.name}
          onChange={event => setFields({ ...fields, name: event.target.value })} />
      </label>
      <label>Класс ученика
        <select name="grade" value={fields.grade}
          onChange={event => setFields({ ...fields, grade: event.target.value })}>
          <option value="">Выбрать класс</option>
          <option value="8">8 класс</option>
          <option value="9">9 класс</option>
          <option value="other">Другой класс</option>
        </select>
      </label>
      <label>Телефон
        <input type="tel" name="phone" autoComplete="tel" maxLength={32} value={fields.phone}
          onChange={event => setFields({ ...fields, phone: event.target.value })} />
      </label>
      <label>Электронная почта
        <input type="email" name="email" autoComplete="email" maxLength={254} value={fields.email}
          onChange={event => setFields({ ...fields, email: event.target.value })} />
      </label>
    </div>
    <div hidden><input name="website" tabIndex={-1} autoComplete="off" /></div>
    <label className={styles.consent}>
      <input type="checkbox" name="consent" value="yes" required checked={fields.consent}
        onChange={event => setFields({ ...fields, consent: event.target.checked })} />
      Согласен на обработку указанных данных для ответа на заявку.
    </label>
    {policyUrl && <a className={styles.policy} href={policyUrl} target="_blank" rel="noreferrer">Политика обработки данных ↗</a>}
    {result.status === "error" && <p className={styles.error} role="alert">{result.message}</p>}
    <button className={styles.send} disabled={pending}>{pending ? "Отправляем…" : "Отправить заявку"}</button>
  </form>;
}
