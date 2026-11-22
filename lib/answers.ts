import type { AnswerFormat, Grade, Task } from "./model";

export const shortAnswerLimit = 200;

export function normalizeShortAnswer(value: string, format: AnswerFormat) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (format === "text") return trimmed.normalize("NFC").replace(/\s+/gu, " ").toLocaleLowerCase("ru");

  const number = /^([+-]?)(\d*)(?:[.,](\d+))?$/.exec(trimmed);
  if (!number || (!number[2] && !number[3])) return null;
  const whole = number[2].replace(/^0+/, "") || "0";
  const fraction = number[3]?.replace(/0+$/, "") || "";
  const sign = number[1] === "-" && (whole !== "0" || fraction) ? "-" : "";
  return sign + whole + (fraction ? "." + fraction : "");
}

export function hasAutomaticGrade(task: Task) {
  if (task.response === "short") return Boolean(task.answerKey?.values.length);
  return (task.response === "single" || task.response === "multiple") && Boolean(task.correct?.length);
}

export function automaticGrade(task: Task, answer: string | number[] | undefined): Grade | null {
  if (!hasAutomaticGrade(task)) return null;
  let correct = false;
  if (task.response === "short" && task.answerKey && typeof answer === "string") {
    const { format, values } = task.answerKey;
    const normalized = normalizeShortAnswer(answer, format);
    correct = normalized !== null && values.some(value => normalizeShortAnswer(value, format) === normalized);
  } else if (Array.isArray(answer) && task.correct) {
    correct = answer.length === task.correct.length && answer.every(option => task.correct!.includes(option));
  }
  return { score: correct ? task.max : 0, comment: correct ? "Верно." : "Неверно." };
}
