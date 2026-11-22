"use server";
import { exceedsTextLimit, hasIncompleteFormula } from "./rich-document";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { account } from "../lib/auth";
import { first, rows } from "../lib/db";
import { normalizeShortAnswer, shortAnswerLimit } from "../lib/answers";
import { libraryKinds, libraryPath, libraryWorkKinds, optionalTaskSections, type LibraryEntry, type LibraryKind, type LibraryTask, type LibraryWorkKind, type TheoryTemplate } from "../lib/library";
import type { Material, Task, WorkSettings } from "../lib/model";

type Result = { error: string };
class FormError extends Error {}
const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const rich = (form: FormData, name: string) => String(form.get(name) ?? "").trimEnd();
function limited(value: string, max: number, label: string, required = false, checkFormulas = false) {
  if (exceedsTextLimit(value, max) || (required && !value)) throw new FormError(label + " — заполните поле (до " + max + " символов).");
  if (checkFormulas && hasIncompleteFormula(value)) throw new FormError(label + " — заполните или удалите незавершённую формулу.");
  return value;
}
function count(value: string, low: number, high: number, label: string) {
  const n = Number(value);
  if (!value || !Number.isInteger(n) || n < low || n > high) throw new FormError(label + " — число от " + low + " до " + high + ".");
  return n;
}
function optionalCount(form: FormData, key: string, min: number, max: number, label: string) {
  const value = field(form, key);
  return value ? count(value, min, max, label) : undefined;
}
function url(value: string) {
  if (!value) return "";
  const parsed = URL.canParse(value) ? new URL(value) : null;
  if (parsed?.protocol !== "https:" || parsed.username || parsed.password || value.length > 2048) throw new FormError("Укажите корректную HTTPS-ссылку.");
  return value;
}
function parseTheory(raw: string, title: string, ready: boolean): TheoryTemplate {
  const content = JSON.parse(raw);
  if (!content || typeof content !== "object" || Array.isArray(content)) throw new FormError("Проверьте структуру теории.");
  const text = (value: unknown) => typeof value === "string" ? value : "";
  const topic = limited(text(content.topic).trim(), 100, "Тема", ready);
  const theory = limited(text(content.theory).trimEnd(), 15000, "Вводный текст", false, ready);
  const blocks = content.materials ?? [];
  if (!Array.isArray(blocks) || blocks.length > 32) throw new FormError("Добавьте не более 32 блоков.");
  const materials = blocks.map((block): Material => {
    const kind = block?.kind as Material["kind"];
    if (!["text", "link", "example", "definition"].includes(kind)) throw new FormError("Неизвестный тип материала.");
    const body = kind === "link" ? text(block.value).trim() : text(block.value).trimEnd();
    const value = limited(body, kind === "link" ? 2048 : 15000, "Содержимое блока", ready, ready && kind !== "link");
    return {
      title: limited(text(block.title).trim(), 120, "Название блока", ready),
      kind,
      phase: block.phase === "after" ? "after" : "before",
      value: ready && kind === "link" ? url(value) : value
    };
  });
  if (ready && !theory && !materials.length) throw new FormError("Добавьте вводный текст или блок теории.");
  return { title, topic, theory, materials };
}

function errorResult(error: unknown): Result {
  if (error instanceof FormError) return { error: error.message };
  console.error(error);
  return { error: "Не удалось сохранить. Повторите попытку." };
}

export async function saveLibrary(_previous: Result, form: FormData): Promise<Result> {
  const teacher = await account();
  if (teacher?.role !== "teacher") return { error: "Библиотека недоступна." };
  const kind = field(form, "kind") as LibraryKind;
  if (!libraryKinds.includes(kind)) return { error: "Неизвестный тип материала." };
  const id = field(form, "id");
  const key = id || randomUUID();
  const ready = field(form, "ready") === "yes";
  try {
    const title = limited(field(form, "title"), 120, "Название", ready);
    let data: LibraryEntry["data"];
    if (kind === "theory") {
      try {
        data = parseTheory(field(form, "theory"), title, ready);
      } catch (error) {
        throw new FormError(error instanceof Error ? error.message : "Проверьте теорию.");
      }
    } else if (kind === "task") {
      const theoryId = field(form, "theoryId");
      if (theoryId && !await first("SELECT id FROM library_items WHERE id=$1 AND kind='theory' AND teacher_id=$2", [theoryId, teacher.id])) throw new FormError("Связанная теория недоступна. Выберите другую или оставьте поле пустым.");
      const response = field(form, "response") as Task["response"];
      if (!response || !["file", "text", "short", "single", "multiple"].includes(response)) throw new FormError("Выберите формат ответа.");
      let answerKey: Task["answerKey"];
      if (response === "short") {
        const format = field(form, "answerFormat");
        if (format !== "text" && format !== "number") throw new FormError("Выберите тип короткого ответа.");
        const values = field(form, "acceptedAnswers").split(/\r?\n/).map(value => value.trim()).filter(Boolean);
        if (values.length > 20 || values.some(value => value.length > shortAnswerLimit || normalizeShortAnswer(value, format) === null)) {
          throw new FormError("Укажите до 20 правильных ответов, каждый до 200 символов. В числовых ответах используйте целые или десятичные числа.");
        }
        if (ready && !values.length) throw new FormError("Укажите хотя бы один правильный ответ.");
        answerKey = { format, values: [...new Set(values)] };
      }
      const options = response === "single" || response === "multiple" ? form.getAll("option").map(value => limited(String(value).trim(), 500, "Вариант ответа", ready, ready)) : [];
      const correct = options.length ? [...new Set(form.getAll("correct").map(Number))] : [];
      if (options.length > 12 || correct.some(index => !Number.isInteger(index) || index < 0 || index >= options.length) ||
        (ready && (response === "single" || response === "multiple") && (options.length < 2 || new Set(options).size !== options.length || !correct.length || (response === "single" && correct.length !== 1)))) throw new FormError("Добавьте разные варианты и отметьте правильные ответы.");
      data = {
        title, topic: limited(field(form, "topic"), 100, "Тема", ready),
        prompt: limited(rich(form, "prompt"), 5000, "Условие", ready, ready),
        max: count(field(form, "max"), 1, 100, "Баллы"),
        hint: limited(rich(form, "hint"), 3000, "Подсказка", false, ready),
        solution: limited(rich(form, "solution"), 6000, "Разбор", false, ready),
        rubric: limited(rich(form, "rubric"), 5000, "Критерии проверки", false, ready),
        response, options, correct, answerKey,
        modelAnswer: limited(rich(form, "modelAnswer"), 8000, "Образец ответа", false, ready),
        hiddenSections: optionalTaskSections.filter(section => form.has("hide." + section)),
        theoryId: theoryId || undefined
      };
    } else {
      const workKind = field(form, "workKind") as LibraryWorkKind;
      if (!libraryWorkKinds.includes(workKind)) throw new FormError("Выберите тип работы.");
      const selected = [...new Set(form.getAll("task").map(String))];
      if (selected.length > 48 || (ready && !selected.length)) throw new FormError("Добавьте от 1 до 48 задач.");
      const existing = id ? await first<Extract<LibraryEntry, { kind: "work" }>>("SELECT * FROM library_items WHERE id=$1 AND kind='work' AND teacher_id=$2", [id, teacher.id]) : undefined;
      const tasks = await rows<Extract<LibraryEntry, { kind: "task" }>>("SELECT id,kind,title,ready,data FROM library_items WHERE kind='task' AND ready AND id=ANY($1::text[]) AND teacher_id=$2", [selected, teacher.id]);
      const entries = selected.map(taskId => {
        const latest = tasks.find(task => task.id === taskId);
        const snapshot = existing?.data.tasks.find(task => task.id === taskId);
        if (!latest && !snapshot) throw new FormError("Одна из выбранных задач недоступна.");
        const { hiddenSections = [], theoryId: _theoryId, ...task } = (latest?.data ?? snapshot?.task)! as LibraryTask;
        for (const section of hiddenSections) delete task[section];
        return { id: taskId, task };
      });
      const settings: WorkSettings = { instructions: limited(rich(form, "instructions"), 5000, "Инструкция", false, ready) };
      if (workKind === "homework") settings.dueDays = optionalCount(form, "dueDays", 1, 90, "Срок в днях");
      if (workKind === "assessment") {
        settings.minutes = optionalCount(form, "minutes", 1, 480, "Рекомендуемое время");
        settings.pass = optionalCount(form, "pass", 0, 100, "Порог");
      }
      data = { title, topic: limited(field(form, "topic"), 100, "Тема"), kind: workKind, settings, tasks: entries };
    }
    if (id) {
      const changed = await first("UPDATE library_items SET title=$3,ready=$4,data=$5,updated=now() WHERE id=$1 AND kind=$2 AND teacher_id=$6 RETURNING id", [id, kind, title, ready, JSON.stringify(data), teacher.id]);
      if (!changed) throw new FormError("Материал недоступен.");
    } else {
      await rows("INSERT INTO library_items(id,kind,title,ready,data,teacher_id) VALUES ($1,$2,$3,$4,$5,$6)", [key, kind, title, ready, JSON.stringify(data), teacher.id]);
    }
  } catch (error) { return errorResult(error); }
  redirect(libraryPath(kind, key) + "&saved=1");
}

export async function deleteLibrary(_previous: Result, form: FormData): Promise<Result> {
  const teacher = await account();
  if (teacher?.role !== "teacher") return { error: "Библиотека недоступна." };
  const kind = field(form, "kind") as LibraryKind;
  const id = field(form, "id");
  if (!libraryKinds.includes(kind) || !id) return { error: "Материал недоступен." };
  try {
    const deleted = await first("DELETE FROM library_items WHERE id=$1 AND kind=$2 AND teacher_id=$3 RETURNING id", [id, kind, teacher.id]);
    if (!deleted) throw new FormError("Материал уже удалён или недоступен.");
  } catch (error) { return errorResult(error); }
  redirect(libraryPath(kind) + "&deleted=1");
}
