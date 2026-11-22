"use server";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { automaticGrade, shortAnswerLimit } from "../lib/answers";
import { cookieName, hash, requireAccount, token } from "../lib/auth";
import { bookingLoginPath, loginDestination } from "../lib/booking";
import { first, rows, transaction } from "../lib/db";
import { workPath } from "../lib/paths";
import type { Assignment, Attachment, Submission, WorkKind } from "../lib/model";
import { workKinds, workState, workTasks } from "../lib/work";
import { demoAccounts, demoLoginEnabled } from "../lib/demo-access";

class InputError extends Error {}
const reject = (message: string): never => { throw new InputError(message); };
const input = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const json = JSON.stringify;

function integer(value: string, min: number, max: number) {
  const number = Number(value);
  if (!value || !Number.isInteger(number) || number < min || number > max) reject("Введите балл в допустимом диапазоне.");
  return number;
}

export async function signIn(form: FormData) {
  const pasted = input(form, "invite");
  const teacher = input(form, "teacher");
  const destination = loginDestination(teacher);
  const errorPath = destination === "/cabinet" ? "/login?error=invite" : bookingLoginPath(teacher) + "&error=invite";
  const invite = /^(?:[a-z][a-z0-9_-]*:\s*)?([A-Za-z0-9_-]{43})$/i.exec(pasted)?.[1];
  if (!invite) redirect(errorPath);
  const key = token();
  const redeemed = await transaction(async connection => {
    const row = await first<{ account: string; teacher_id: string | null }>("UPDATE invites SET used=now() WHERE hash=$1 AND (reusable OR used IS NULL) AND expires>now() RETURNING account,teacher_id", [hash(invite)], connection);
    if (!row) return false;
    if (row.teacher_id) {
      await rows("INSERT INTO teacher_students(teacher_id,student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [row.teacher_id, row.account], connection);
    }
    await rows("INSERT INTO sessions(hash,account,expires) VALUES ($1,$2,now()+interval '14 days')", [hash(key), row.account], connection);
    return true;
  });
  if (!redeemed) redirect(errorPath);
  const secure = process.env.OLIMPIK_SECURE_COOKIES === "true" || (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(cookieName, key, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 14 * 86400 });
  redirect(destination);
}
export async function signOut() {
  const jar = await cookies();
  const key = jar.get(cookieName)?.value;
  if (key) await rows("DELETE FROM sessions WHERE hash=$1", [hash(key)]);
  jar.delete(cookieName);
  redirect("/login");
}

export async function demoSignIn(form: FormData) {
  if (!demoLoginEnabled()) redirect("/login");
  const role = input(form, "role");
  if (role !== "student" && role !== "teacher") redirect("/login");
  const id = role === "student" && input(form, "demoStudent") === "dina" ? "dina" : demoAccounts[role];
  const teacher = input(form, "teacher");
  const destination = loginDestination(teacher);
  const key = token();
  const jar = await cookies();
  const previous = jar.get(cookieName)?.value;
  const created = await transaction(async connection => {
    const user = await first("SELECT id FROM accounts WHERE id=$1 AND role=$2", [id, role], connection);
    if (!user) return false;
    await rows("INSERT INTO sessions(hash,account,expires,demo) VALUES ($1,$2,now()+interval '1 day',true)", [hash(key), id], connection);
    if (previous) await rows("DELETE FROM sessions WHERE hash=$1", [hash(previous)], connection);
    return true;
  });
  if (!created) redirect(destination === "/cabinet" ? "/login?error=demo" : bookingLoginPath(teacher) + "&error=demo");
  const secure = process.env.OLIMPIK_SECURE_COOKIES === "true" || (await headers()).get("x-forwarded-proto") === "https";
  jar.set(cookieName, key, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 86400 });
  redirect(destination);
}

export async function submitWork(form: FormData) {
  const user = await requireAccount("student");
  const assignmentId = input(form, "assignment");
  const kind = input(form, "kind") as WorkKind;
  const taskParam = input(form, "task");
  if (!assignmentId || !workKinds.includes(kind)) redirect("/cabinet/homework");
  const back = workPath(assignmentId, kind) + (/^\d+$/.test(taskParam) ? "?task=" + taskParam : "");
  try {
    const assignment = await first<Assignment>("SELECT * FROM assignments WHERE id=$1 AND student_id=$2", [assignmentId, user.id]);
    if (!assignment) return reject("Работа недоступна.");
    const sectionTasks = workTasks(assignment, kind);
    const tasks = taskParam ? sectionTasks.filter(({ index }) => String(index) === taskParam) : sectionTasks;
    if (!tasks.length) reject("Работа недоступна.");
    const documents: (Attachment & { mime: string; bytes: Buffer })[] = [];
    const answers: NonNullable<Submission["answers"]> = {};
    let size = 0;
    for (const { index: task, task: definition } of tasks) {
      if (definition.response === "text" || definition.response === "short") {
        const answer = input(form, "answer." + task);
        if (!answer || answer.length > (definition.response === "short" ? shortAnswerLimit : 12000)) reject("Проверьте заполнение полей.");
        answers[task] = answer;
        continue;
      }
      if (definition.response === "single" || definition.response === "multiple") {
        const values = form.getAll("answer." + task);
        const selected = [...new Set(values.map(value => integer(String(value), 0, (definition.options?.length ?? 0) - 1)))];
        if (!selected.length || (definition.response === "single" && selected.length !== 1)) reject("Выберите ответ для каждого тестового задания.");
        answers[task] = selected;
        continue;
      }
      const uploads = form.getAll("file." + task).filter((file): file is File => file instanceof File && file.size > 0);
      if (!uploads.length || uploads.length > 3) reject("Прикрепите от одного до трёх файлов к каждому заданию.");
      for (const upload of uploads) {
        size += upload.size;
        if (upload.size > 6_000_000 || size > 24_000_000) reject("Лимит — 6 МБ на файл и 24 МБ на работу.");
        const bytes = Buffer.from(await upload.arrayBuffer());
        const mime = bytes.subarray(0, 5).toString() === "%PDF-" ? "application/pdf"
          : bytes.subarray(0, 3).toString("hex") === "ffd8ff" ? "image/jpeg"
          : bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" ? "image/png" : "";
        if (!mime) reject("Поддерживаются PDF, JPEG и PNG.");
        documents.push({ id: randomUUID(), name: upload.name.slice(0, 180), task, bytes, mime });
      }
    }
    await transaction(async connection => {
      const key = [assignment.id, user.id];
      const latest = await first<Assignment>("SELECT * FROM assignments WHERE id=$1 AND student_id=$2 FOR UPDATE", key, connection);
      if (!latest || String(latest.revision) !== input(form, "revision")) reject("Материалы изменились. Откройте работу заново.");
      await rows("INSERT INTO submissions(assignment,student,files) VALUES ($1,$2,'[]') ON CONFLICT DO NOTHING", key, connection);
      const current = await first<Submission>("SELECT * FROM submissions WHERE assignment=$1 AND student=$2 FOR UPDATE", key, connection);
      if (workState(tasks, current) !== "pending") reject("Работа уже сдана.");
      if (tasks.some(({ index }) => current?.grades?.[index] || current?.files.some(file => file.task === index) || Object.hasOwn(current?.answers ?? {}, index))) reject("Ответ на задание уже отправлен.");
      const sectionIndexes = new Set(sectionTasks.map(({ index }) => index));
      const attachmentIds = (current?.files ?? []).filter(file => sectionIndexes.has(file.task)).map(file => file.id);
      const stored = await first<{ size: string }>("SELECT COALESCE(SUM(octet_length(bytes)),0)::text AS size FROM attachments WHERE id=ANY($1::text[])", [attachmentIds], connection);
      if (Number(stored?.size ?? 0) + size > 24_000_000) reject("Лимит — 24 МБ на работу.");
      const files = [...(current?.files ?? []), ...documents.map(({ id, name, task }) => ({ id, name, task }))];
      const grades = assignment.content.tasks.map((_, index) => current?.grades?.[index] ?? null);
      for (const { task, index } of tasks) {
        grades[index] = automaticGrade(task, answers[index]);
      }
      await rows("UPDATE submissions SET files=$3,answers=$4,grades=$5 WHERE assignment=$1 AND student=$2", [...key, json(files), json({ ...current?.answers, ...answers }), json(grades.some(Boolean) ? grades : null)], connection);
      for (const file of documents) {
        await rows("INSERT INTO attachments VALUES ($1,$2,$3,$4,$5,$6)", [file.id, user.id, assignment.id, file.name, file.mime, file.bytes], connection);
      }
    });
  } catch (error) {
    if (!(error instanceof InputError)) {
      console.error(error);
    }
    const message = error instanceof InputError ? error.message : "Не удалось сохранить. Повторите попытку.";
    redirect(withNotice(back, "error", message));
  }
  revalidatePath("/cabinet", "layout");
  redirect(withNotice(back, "saved", "1"));
}
function withNotice(url: string, key: string, value: string) {
  const cut = url.indexOf("#");
  const hash = cut === -1 ? "" : url.slice(cut);
  const path = cut === -1 ? url : url.slice(0, cut);
  return path + (path.includes("?") ? "&" : "?") + key + "=" + encodeURIComponent(value) + hash;
}
