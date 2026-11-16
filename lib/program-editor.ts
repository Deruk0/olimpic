import type { Lesson, Material, Program, ProgramKey, Task, WorkKind, WorkSettings } from "./model";
import { exceedsTextLimit, hasIncompleteFormula } from "../app/rich-document";
import { workKind, workKinds, workLabels } from "./work";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Проверьте структуру программы.");
  return value as Record<string, unknown>;
}
function list(value: unknown, limit: number) {
  if (!Array.isArray(value) || value.length > limit) throw Error("Превышен лимит блоков или занятий.");
  return value as unknown[];
}

export function parseProgram(raw: string, level: ProgramKey, publish: boolean): Program {
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { throw Error("Не удалось прочитать программу."); }
  const program = record(payload);
  function field(value: unknown, max: number, label: string, required = true, formatted = false) {
    const text = typeof value === "string" ? (formatted ? value.trimEnd() : value.trim()) : "";
    if ((formatted ? exceedsTextLimit(text, max) : text.length > max) || (publish && required && !text.trim())) throw Error(label + " — заполните поле (до " + max + " символов).");
    if (publish && formatted && hasIncompleteFormula(text)) throw Error(label + " — заполните или удалите незавершённую формулу.");
    return text;
  }
  function number(value: unknown, min: number, max: number, label: string) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw Error(label + " — укажите число от " + min + " до " + max + ".");
    return value;
  }
  const diagnostic = level === "diagnostic";
  const lessons = list(program.lessons, diagnostic ? 1 : 30).map((entry, i): Lesson => {
    const source = record(entry);
    const context = "Занятие " + (i + 1) + " · ";
    const title = field(source.title, 120, context + "название");
    const topic = field(source.topic, 100, context + "тема");
    const theory = field(source.theory, 15000, context + "вводный текст", false, true);
    const tasks = list(source.tasks, 48).map((value, j): Task => {
      const task = record(value);
      const kind = workKind(task as Task, diagnostic);
      if (!workKinds.includes(kind) || (!diagnostic && kind === "diagnostic")) throw Error("Неизвестный тип задания.");
      const label = context + workLabels[kind] + ", задача " + (j + 1);
      return {
        kind, title: field(task.title, 120, label + " · название"),
        prompt: field(task.prompt, 5000, label + " · условие", true, true),
        topic: field(task.topic || topic, 100, label + " · тема"),
        max: number(task.max, 1, 100, label + " · баллы"),
        hint: kind === "practice" ? field(task.hint, 3000, label + " · подсказка", false, true) : "",
        solution: kind === "practice" ? field(task.solution, 6000, label + " · разбор", false, true) : "",
        rubric: field(task.rubric, 5000, label + " · критерии", false, true)
      };
    });
    const materials = list(source.materials ?? [], 32).map((value): Material => {
      const block = record(value);
      const kind = block.kind as Material["kind"];
      if (!["text", "link", "example", "definition"].includes(kind)) throw Error("Неизвестный тип материала.");
      const body = field(block.value, kind === "link" ? 2048 : 15000, context + "содержимое блока", true, kind !== "link");
      if (publish && kind === "link") {
        const url = URL.canParse(body) ? new URL(body) : null;
        if (url?.protocol !== "https:" || url.username || url.password) throw Error(context + "для ссылки нужен корректный HTTPS-адрес.");
      }
      return { title: field(block.title, 120, context + "название блока"), kind, phase: block.phase === "after" ? "after" : "before", value: body };
    });
    const settings = record(source.work ?? {});
    const work: Lesson["work"] = {};
    for (const kind of workKinds) {
      if (!settings[kind]) continue;
      const value = record(settings[kind]);
      const parsed: WorkSettings = { instructions: field(value.instructions, 5000, context + "инструкция", false, true) };
      if (kind === "assessment") {
        if (value.minutes !== undefined) parsed.minutes = number(value.minutes, 1, 480, context + "рекомендуемое время");
        if (value.pass !== undefined) parsed.pass = number(value.pass, 0, 100, context + "порог");
      }
      if (kind === "homework" && value.dueDays !== undefined) parsed.dueDays = number(value.dueDays, 1, 90, context + "срок домашней работы");
      work[kind as WorkKind] = parsed;
    }
    if (publish && diagnostic && !tasks.length) throw Error("Добавьте хотя бы одну задачу диагностики.");
    if (publish && !diagnostic && !tasks.length && !theory && !materials.length) throw Error(context + "добавьте теорию или работу.");
    return { title, topic, theory, tasks, materials, work };
  });
  if (publish && !lessons.length) throw Error("Добавьте хотя бы одно занятие.");
  return { lessons, olympiad: field(program.olympiad, 120, "Целевая олимпиада"),
    advanced: number(program.advanced, 1, 100, "Порог продвинутого уровня"),
    priority: number(program.priority, 1, 100, "Порог приоритетной темы") };
}
