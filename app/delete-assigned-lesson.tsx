"use client";

import { useActionState } from "react";
import { deleteAssignedLesson } from "./assignment-actions";

export function DeleteAssignedLesson({ id, title }: { id: string; title: string }) {
  const [result, action, pending] = useActionState(deleteAssignedLesson, { error: "" });
  return <details className="danger-zone">
    <summary>Удалить назначенное занятие</summary>
    <p>Удалить «{title}» из расписания? Оно станет недоступно ученикам. Сданные работы и оценки останутся у куратора в истории проверки.</p>
    <form action={action} className="editor">
      <input type="hidden" name="assignment" value={id} />
      <label className="confirmation-check"><input type="checkbox" name="confirm" value={id} required disabled={pending} />Подтверждаю удаление этого занятия</label>
      {result.error && <p className="notice error" role="alert">{result.error}</p>}
      <button className="plain" disabled={pending}>{pending ? "Удаление…" : "Удалить занятие"}</button>
    </form>
  </details>;
}
