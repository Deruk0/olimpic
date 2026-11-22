"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasAutomaticGrade } from "../../lib/answers";
import { requireAccount } from "../../lib/auth";
import { lockTeacherBooking } from "../../lib/booking";
import { first, rows, transaction, type Connection } from "../../lib/db";
import { parseLessonTime } from "../../lib/lesson-time";
import type { TheoryTemplate, WorkTemplate } from "../../lib/library";
import { formats, type Assignment, type Lesson, type LessonSettings, type Submission, type WorkKind } from "../../lib/model";
import { reviewPath } from "../../lib/paths";
import { enqueueReview } from "../../lib/telegram-data";
import { workKinds, workScore, workState, workTasks, workTitle } from "../../lib/work";

const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
class FormError extends Error {}

async function requireStudent(teacher: string, student: string, connection: Connection) {
  const linked = await first("SELECT 1 FROM teacher_students WHERE teacher_id=$1 AND student_id=$2 FOR SHARE", [teacher, student], connection);
  if (!linked) throw new FormError("Выберите ученика из своего списка.");
}

function errorMessage(error: unknown) {
  if (!(error instanceof FormError)) console.error(error);
  return error instanceof FormError ? error.message : "Не удалось сохранить. Попробуйте ещё раз.";
}

function fail(path: string, error: unknown): never {
  redirect(path + (path.includes("?") ? "&" : "?") + "error=" + encodeURIComponent(errorMessage(error)));
}

export async function saveLesson(_previous: { error: string }, form: FormData) {
  const teacher = await requireAccount("teacher");
  const id = field(form, "id");
  const student = field(form, "student");
  try {
    const title = field(form, "title");
    const starts = parseLessonTime(field(form, "starts"));
    const duration = Number(field(form, "duration"));
    const format = field(form, "format") as LessonSettings["format"];
    const location = format === "offline" ? field(form, "location") : "";
    if (!title || title.length > 120) throw new FormError("Введите название занятия до 120 символов.");
    if (!starts) throw new FormError("Укажите дату и время занятия.");
    if (!Number.isInteger(duration) || duration < 5 || duration > 480) throw new FormError("Укажите длительность от 5 до 480 минут.");
    if (!Object.hasOwn(formats, format)) throw new FormError("Выберите формат занятия.");
    if (format === "offline" && (!location || location.length > 300)) throw new FormError("Укажите место очного занятия.");

    await transaction(async connection => {
      await lockTeacherBooking(teacher.id, connection);
      if (id) {
        const updated = await first(
          `UPDATE assignments SET starts=$3,settings=settings || $4::jsonb,
             content=jsonb_set(content,'{title}',to_jsonb($5::text)),revision=revision+1
           WHERE id=$1 AND teacher_id=$2 AND entry_kind='lesson' AND cancelled_at IS NULL RETURNING id`,
          [id, teacher.id, starts.toISOString(), JSON.stringify({ format, duration, location }), title], connection);
        if (!updated) throw new FormError("Занятие недоступно.");
        return;
      }

      await requireStudent(teacher.id, student, connection);
      const theoryId = field(form, "theory");
      const theory = theoryId ? await first<{ data: TheoryTemplate }>(
        "SELECT data FROM library_items WHERE id=$1 AND teacher_id=$2 AND kind='theory' AND ready",
        [theoryId, teacher.id], connection) : undefined;
      if (theoryId && !theory) throw new FormError("Выберите готовую теорию из своей библиотеки.");
      const content: Lesson = { topic: "", theory: "", ...theory?.data, title, tasks: [] };
      await rows("INSERT INTO assignments(id,teacher_id,student_id,content,starts,settings) VALUES ($1,$2,$3,$4,$5,$6)",
        [randomUUID(), teacher.id, student, JSON.stringify(content), starts.toISOString(), JSON.stringify({ format, duration, location })], connection);
    });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePath("/cabinet/schedule");
  redirect("/cabinet/schedule?saved=1");
}

export async function cancelLesson(id: string) {
  const teacher = await requireAccount("teacher");
  const path = "/cabinet/schedule";
  try {
    const cancelled = await first(`UPDATE assignments SET cancelled_at=now()
      WHERE id=$1 AND teacher_id=$2 AND entry_kind='lesson' AND cancelled_at IS NULL RETURNING id`, [id, teacher.id]);
    if (!cancelled) throw new FormError("Урок недоступен или уже отменён.");
  } catch (error) {
    fail(path, error);
  }
  revalidatePath(path);
  redirect(path + "?saved=1");
}

export async function issueHomework(form: FormData) {
  const teacher = await requireAccount("teacher");
  const student = field(form, "student");
  const lesson = field(form, "lesson");
  const template = field(form, "template");
  const id = randomUUID();
  try {
    const deadline = parseLessonTime(field(form, "deadline"));
    if (!deadline) throw new FormError("Укажите дату и время дедлайна.");
    await transaction(async connection => {
      await requireStudent(teacher.id, student, connection);
      if (lesson && !await first(
        "SELECT 1 FROM assignments WHERE id=$1 AND teacher_id=$2 AND student_id=$3 AND entry_kind='lesson' AND cancelled_at IS NULL",
        [lesson, teacher.id, student], connection)) throw new FormError("Выберите урок этого ученика.");

      const work = await first<{ data: WorkTemplate }>(
        "SELECT data FROM library_items WHERE id=$1 AND teacher_id=$2 AND kind='work' AND ready AND data->>'kind'='homework'",
        [template, teacher.id], connection);
      if (!work?.data.tasks.length) throw new FormError("Выберите готовое домашнее задание из своей библиотеки.");
      if (work.data.tasks.some(({ task }) => task.response === "short" && !hasAutomaticGrade(task))) {
        throw new FormError("В шаблоне есть короткий ответ без ключа. Обновите шаблон в библиотеке.");
      }
      const { title, topic, settings, tasks } = work.data;
      const content: Lesson = {
        title, topic: topic || "", theory: "",
        tasks: tasks.map(({ task }) => ({ ...task, kind: "homework" })),
        work: { homework: { title, instructions: settings.instructions } }
      };
      await rows(`INSERT INTO assignments(id,teacher_id,student_id,content,starts,entry_kind,lesson_id,due_at)
        VALUES ($1,$2,$3,$4,now(),'homework',$5,$6)`,
        [id, teacher.id, student, JSON.stringify(content), lesson || null, deadline.toISOString()], connection);
    });
  } catch (error) {
    fail("/cabinet/review/issue?student=" + encodeURIComponent(student) + "&lesson=" + encodeURIComponent(lesson) + "&template=" + encodeURIComponent(template), error);
  }
  revalidatePath("/cabinet/homework");
  revalidatePath("/cabinet/review");
  redirect(reviewPath(id, "homework") + "?issued=1");
}

export async function gradeTask(id: string, kind: WorkKind, index: number, form: FormData) {
  const teacher = await requireAccount("teacher");
  const path = reviewPath(id, kind) + "?task=" + index;
  try {
    await transaction(async connection => {
      const assignment = await first<Assignment>(
        "SELECT * FROM assignments WHERE id=$1 AND teacher_id=$2 FOR UPDATE", [id, teacher.id], connection);
      if (!assignment || !workKinds.includes(kind)) throw new FormError("Работа недоступна.");
      const tasks = workTasks(assignment, kind);
      const found = tasks.find(item => item.index === index);
      if (!found || hasAutomaticGrade(found.task)) throw new FormError("Это задание не требует ручной проверки.");
      const points = field(form, "score");
      const score = Number(points);
      const comment = field(form, "comment");
      if (!/^\d+$/.test(points) || score > found.task.max || comment.length > 3000) {
        throw new FormError("Проверьте баллы и длину комментария.");
      }
      const key = [id, assignment.student_id];
      const submission = await first<Submission>(
        "SELECT * FROM submissions WHERE assignment=$1 AND student=$2 FOR UPDATE", key, connection);
      if (!submission || workState(tasks, submission) === "pending") throw new FormError("Ученик ещё не сдал всю работу.");
      const grades = assignment.content.tasks.map((_, position) => submission.grades?.[position] ?? null);
      grades[index] = { score, comment };
      await rows("UPDATE submissions SET grades=$3 WHERE assignment=$1 AND student=$2", [...key, JSON.stringify(grades)], connection);
      const reviewed = { ...submission, grades };
      if (workState(tasks, submission) !== "reviewed" && workState(tasks, reviewed) === "reviewed") {
        const result = workScore(tasks, reviewed);
        const comments = tasks.flatMap(({ task, index }) =>
          !hasAutomaticGrade(task) && grades[index]?.comment ? [task.title + " — " + grades[index].comment] : []);
        const body = ["Работа проверена · " + workTitle(assignment, kind), "Баллы: " + result.score + " / " + result.total,
          ...comments].join("\n");
        await enqueueReview(connection, assignment.student_id, id, kind, body);
      }
    });
  } catch (error) {
    fail(path, error);
  }
  revalidatePath("/cabinet/homework");
  revalidatePath("/cabinet/review");
  redirect(path + "&saved=1");
}
