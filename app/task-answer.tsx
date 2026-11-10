import type { Task } from "../lib/model";
import { FormattedText } from "./formatted-text";

export function TaskAnswerInputs({ task, index }: { task: Task; index: number }) {
  if (task.response === "text") {
    return <label>Ваш ответ<textarea name={"answer." + index} rows={6} maxLength={12000} required /></label>;
  }
  if (task.response === "single" || task.response === "multiple") {
    const single = task.response === "single";
    return <div className="answer-options">
      <small>{single ? "Выберите один вариант" : "Выберите все подходящие варианты"}</small>
      {task.options?.map((option, i) => <div className="answer-option" key={i}>
        <input id={"answer-" + index + "-" + i} name={"answer." + index} type={single ? "radio" : "checkbox"} value={i} required={single} aria-label={"Вариант " + (i + 1)} aria-describedby={"option-" + index + "-" + i} />
        <div id={"option-" + index + "-" + i}><label htmlFor={"answer-" + index + "-" + i}>Вариант {i + 1}</label><FormattedText text={option} /></div>
      </div>)}
    </div>;
  }
  return <label>Решение задания «{task.title}»<input name={"file." + index} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple required /></label>;
}

export function TaskOptionList({ task, indexes }: { task: Task; indexes: number[] }) {
  return <ol>{indexes.map(index => <li key={index} value={index + 1}><FormattedText text={task.options?.[index]} /></li>)}</ol>;
}
