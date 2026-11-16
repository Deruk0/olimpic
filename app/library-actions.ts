"use server";
import { exceedsTextLimit, hasIncompleteFormula } from "./rich-document";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { account } from "../lib/auth";
import { first, rows, transaction } from "../lib/db";
import { libraryKinds, libraryPath, libraryWorkKinds, optionalTaskSections, planningPath, type AssignmentSources, type LibraryEntry, type LibraryKind, type LibraryTask, type LibraryWorkKind, type TheoryTemplate, type WorkTemplate } from "../lib/library";
import { emptyProgram, type Assignment, type Lesson, type Task, type WorkSettings } from "../lib/model";
import { parseProgram } from "../lib/program-editor";
import { workKind } from "../lib/work";

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
function errorResult(error: unknown): Result {
  if (error instanceof FormError) return { error: error.message };
  console.error(error);
  return { error: "Не удалось сохранить. Повторите попытку." };
}

export async function saveLibrary(_previous: Result, form: FormData): Promise<Result> {
  if ((await account())?.role !== "methodist") return { error: "Библиотека недоступна." };
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
        const content = JSON.parse(field(form, "theory"));
        const { tasks: _tasks, work: _work, ...theory } = parseProgram(JSON.stringify({
          ...emptyProgram, lessons: [{ ...content, title, tasks: [] }]
        }), "basic", ready).lessons[0];
        data = theory;
      } catch (error) {
        throw new FormError(error instanceof Error ? error.message : "Проверьте теорию.");
      }
    } else if (kind === "task") {
      const theoryId = field(form, "theoryId");
      if (theoryId && !await first("SELECT id FROM library_items WHERE id=$1 AND kind='theory'", [theoryId])) throw new FormError("Связанная теория недоступна. Выберите другую или оставьте поле пустым.");
      const response = field(form, "response") as Task["response"];
      if (!response || !["file", "text", "single", "multiple"].includes(response)) throw new FormError("Выберите формат ответа.");
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
        response, options, correct,
        modelAnswer: limited(rich(form, "modelAnswer"), 8000, "Образец ответа", false, ready),
        hiddenSections: optionalTaskSections.filter(section => form.has("hide." + section)),
        theoryId: theoryId || undefined
      };
    } else {
      const workKind = field(form, "workKind") as LibraryWorkKind;
      if (!libraryWorkKinds.includes(workKind)) throw new FormError("Выберите тип работы.");
      const selected = [...new Set(form.getAll("task").map(String))];
      if (selected.length > 48 || (ready && !selected.length)) throw new FormError("Добавьте от 1 до 48 задач.");
      const existing = id ? await first<Extract<LibraryEntry, { kind: "work" }>>("SELECT * FROM library_items WHERE id=$1 AND kind='work'", [id]) : undefined;
      const tasks = await rows<Extract<LibraryEntry, { kind: "task" }>>("SELECT id,kind,title,ready,data FROM library_items WHERE kind='task' AND ready AND id=ANY($1::text[])", [selected]);
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
      const changed = await first("UPDATE library_items SET title=$3,ready=$4,data=$5,updated=now() WHERE id=$1 AND kind=$2 RETURNING id", [id, kind, title, ready, JSON.stringify(data)]);
      if (!changed) throw new FormError("Материал недоступен.");
    } else {
      await rows("INSERT INTO library_items(id,kind,title,ready,data) VALUES ($1,$2,$3,$4,$5)", [key, kind, title, ready, JSON.stringify(data)]);
    }
  } catch (error) { return errorResult(error); }
  redirect(libraryPath(kind, key) + "&saved=1");
}

export async function deleteLibrary(_previous: Result, form: FormData): Promise<Result> {
  if ((await account())?.role !== "methodist") return { error: "Библиотека недоступна." };
  const kind = field(form, "kind") as LibraryKind;
  const id = field(form, "id");
  if (!libraryKinds.includes(kind) || !id) return { error: "Материал недоступен." };
  try {
    const deleted = await first("DELETE FROM library_items WHERE id=$1 AND kind=$2 RETURNING id", [id, kind]);
    if (!deleted) throw new FormError("Материал уже удалён или недоступен.");
  } catch (error) { return errorResult(error); }
  redirect(libraryPath(kind) + "&deleted=1");
}

export async function savePlannedLesson(_previous: Result, form: FormData): Promise<Result> {
  if ((await account())?.role !== "methodist") return { error: "Расписание недоступно." };
  const id = field(form, "id");
  const key = id || randomUUID();
  try {
    const level = field(form, "level");
    if (level !== "basic" && level !== "advanced") throw new FormError("Выберите уровень.");
    await transaction(async connection => {
      const current = id ? await first<Assignment>("SELECT * FROM assignments WHERE id=$1 AND kind='lesson' AND deleted_at IS NULL FOR UPDATE", [id], connection) : undefined;
      if (id && !current) throw new FormError("Занятие недоступно.");
      if (current && ((current.starts && new Date(current.starts).getTime() <= Date.now()) || await first("SELECT 1 FROM submissions WHERE assignment=$1 LIMIT 1", [id], connection))) {
        throw new FormError("Материалы можно менять до начала занятия, пока по нему нет сданных работ.");
      }
      const group = current?.group_id ?? field(form, "group");
      if (!await first("SELECT id FROM groups WHERE id=$1", [group], connection)) throw new FormError("Выберите группу.");
      const theoryIds = [...new Set(form.getAll("theory").map(String).filter(Boolean))];
      if (!theoryIds.length || theoryIds.length > 12 || (theoryIds.includes("keep") && theoryIds.length !== 1)) throw new FormError("Выберите от 1 до 12 блоков теории.");
      const theoryId = theoryIds[0];
      let theory: TheoryTemplate;
      if (theoryId === "keep" && current) {
        const { title, topic, theory: intro, materials } = current.content;
        theory = { title, topic, theory: intro, materials };
      } else {
        const selected = await first<Extract<LibraryEntry, { kind: "theory" }>>("SELECT data FROM library_items WHERE id=$1 AND kind='theory' AND ready", [theoryId], connection);
        if (!selected) throw new FormError("Выберите готовую теорию из библиотеки.");
        theory = { ...selected.data, materials: [...(selected.data.materials ?? [])] };
        for (const extraId of theoryIds.slice(1)) {
          const extra = await first<{ data: TheoryTemplate }>("SELECT data FROM library_items WHERE id=$1 AND kind='theory' AND ready", [extraId], connection);
          if (!extra) throw new FormError("Один из блоков теории недоступен.");
          theory.materials!.push(...(extra.data.theory ? [{ title: extra.data.title, kind: "text" as const, phase: "before" as const, value: extra.data.theory }] : []), ...(extra.data.materials ?? []));
        }
      }
      const sources: AssignmentSources = { theory: theoryId === "keep" ? current?.sources?.theory ?? "" : theoryId, theoryIds: theoryId === "keep" ? current?.sources?.theoryIds : theoryIds, works: {} };
      const content: Lesson = { ...theory, title: limited(field(form, "title"), 120, "Название занятия") || theory.title, tasks: [], work: {} };
      for (const kind of libraryWorkKinds) {
        const workId = field(form, kind);
        if (!workId) continue;
        if (workId === "keep" && current) {
          content.tasks.push(...current.content.tasks.filter(task => workKind(task, false) === kind));
          const previous = current.content.work?.[kind];
          if (previous) content.work![kind] = previous;
          const source = current.sources?.works[kind];
          if (source) sources.works[kind] = source;
          continue;
        }
        const item = await first<{ data: WorkTemplate }>("SELECT data FROM library_items WHERE id=$1 AND kind='work' AND ready", [workId], connection);
        if (!item || item.data.kind !== kind) throw new FormError("Выберите готовую работу подходящего типа.");
        content.tasks.push(...item.data.tasks.map(({ task }): Task => ({ ...task, kind })));
        content.work![kind] = { ...item.data.settings, title: item.data.title };
        sources.works[kind] = workId;
      }
      const payload = [key, group, level, JSON.stringify(content), JSON.stringify(sources)];
      if (current) {
        await rows("UPDATE assignments SET group_id=$2,level=$3,content=$4,sources=$5,revision=revision+1 WHERE id=$1", payload, connection);
      } else {
        await rows("INSERT INTO assignments(id,group_id,kind,level,content,starts,meeting,sources) VALUES ($1,$2,'lesson',$3,$4,NULL,'',$5)", payload, connection);
      }
    });
  } catch (error) { return errorResult(error); }
  redirect(planningPath(key) + "&saved=1");
}
