"use server";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { account, cookieName, hash, token } from "../lib/auth";
import { first, rows, transaction } from "../lib/db";
import { homeworkPath, managementPath, workPath } from "../lib/paths";
import { recommendation, type Assignment, type Attachment, type Grade, type Group, type LessonSettings, type ProgramRow, type Submission, type Topic, type WorkKind } from "../lib/model";
import { parseProgram } from "../lib/program-editor";
import { workKinds, workState, workTasks } from "../lib/work";

class InputError extends Error {}
const reject = (message: string): never => { throw new InputError(message); };
const input = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const json = JSON.stringify;
function required(form: FormData, name: string, max = 1000) {
  const value = input(form, name);
  if (!value || value.length > max) reject("Проверьте заполнение полей.");
  return value;
}
function integer(value: string, min: number, max: number) {
  const number = Number(value);
  if (!value || !Number.isInteger(number) || number < min || number > max) reject("Введите балл в допустимом диапазоне.");
  return number;
}
function https(value: string) {
  const url = URL.canParse(value) ? new URL(value) : null;
  if (url?.protocol !== "https:" || url.username || url.password || value.length > 2048) reject("Укажите корректную HTTPS-ссылку.");
  return value;
}
async function groupForCurator(id: string, curator: string) {
  const group = await first<Group>("SELECT * FROM groups WHERE id=$1 AND curator=$2", [id, curator]);
  return group ?? reject("Группа недоступна.");
}

export async function signIn(form: FormData) {
  const pasted = input(form, "invite");
  const invite = /^(?:[a-z][a-z0-9_-]*:\s*)?([A-Za-z0-9_-]{43})$/i.exec(pasted)?.[1];
  if (!invite) redirect("/?error=invite");
  const key = token();
  const redeemed = await transaction(async connection => {
    const row = await first<{ account: string }>("UPDATE invites SET used=now() WHERE hash=$1 AND (reusable OR used IS NULL) AND expires>now() RETURNING account", [hash(invite)], connection);
    if (!row) return false;
    await rows("INSERT INTO sessions VALUES ($1,$2,now()+interval '14 days')", [hash(key), row.account], connection);
    return true;
  });
  if (!redeemed) redirect("/?error=invite");
  const secure = process.env.OLIMPIK_SECURE_COOKIES === "true" || (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(cookieName, key, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 14 * 86400 });
  redirect("/cabinet");
}
export async function signOut() {
  const jar = await cookies();
  const key = jar.get(cookieName)?.value;
  if (key) await rows("DELETE FROM sessions WHERE hash=$1", [hash(key)]);
  jar.delete(cookieName);
  redirect("/");
}

export async function saveProgram(_previous: { message: string; error: boolean }, form: FormData) {
  const user = await account();
  if (user?.role !== "methodist") return { message: "Конструктор недоступен.", error: true };
  const level = input(form, "level");
  if (level !== "basic" && level !== "advanced" && level !== "diagnostic") return { message: "Неизвестная программа.", error: true };
  const publish = input(form, "publish") === "yes";
  let program;
  try {
    program = parseProgram(input(form, "program"), level, publish);
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Проверьте программу.", error: true };
  }
  try {
    await rows("INSERT INTO programs VALUES ($1,$2,CASE WHEN $3 THEN $2::jsonb ELSE NULL END) ON CONFLICT(level) DO UPDATE SET draft=$2,published=CASE WHEN $3 THEN $2::jsonb ELSE programs.published END", [level, json(program), publish]);
  } catch (error) {
    console.error(error);
    return { message: "Не удалось сохранить программу. Повторите попытку.", error: true };
  }
  revalidatePath("/cabinet");
  return { message: publish ? "Программа опубликована." : "Черновик сохранён.", error: false };
}

export async function mutate(form: FormData) {
  const user = await account();
  if (!user) redirect("/");
  const action = input(form, "action");
  const section = input(form, "return");
  const levelParam = input(form, "level");
  const assignmentParam = input(form, "assignment");
  const workParam = input(form, "kind") as WorkKind;
  const work = workKinds.includes(workParam) ? workParam : undefined;
  const staffId = section === "students" ? input(form, "student") : section === "groups" ? input(form, "group") : assignmentParam;
  const staffDetail = input(form, "detail") === "yes" && ["schedule", "review", "students", "groups"].includes(section) && !!staffId;
  const reviewStudent = input(form, "student");
  const back = action === "submit" && section === "homework" && assignmentParam ? (work ? workPath(assignmentParam, work) : homeworkPath(assignmentParam)) :
    staffDetail ? managementPath(section, staffId, section === "review" ? reviewStudent : undefined, work) :
    "/cabinet" + (/^[a-z]+$/.test(section) ? "?view=" + section : "") +
    (section === "programs" && ["basic", "advanced", "diagnostic"].includes(levelParam) ? "&level=" + levelParam : "") +
    (section === "learn" && /^[\w-]{1,60}$/.test(assignmentParam) ? "&work=" + assignmentParam : "");
  try {
    if (action === "guidance" && user.role === "methodist") {
      const group = await first("SELECT id FROM groups WHERE id=$1", [input(form, "group")]);
      if (!group) reject("Группа недоступна.");
      await rows("INSERT INTO guidance(group_id,id,message) VALUES ($1,$2,$3)", [input(form, "group"), randomUUID(), required(form, "message", 1500)]);
    } else if ((action === "schedule" || action === "reschedule") && user.role === "curator") {
      const date = required(form, "starts");
      const localTime = Date.parse(date + "Z");
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date) || !Number.isFinite(localTime) || new Date(localTime).toISOString().slice(0,16) !== date) reject("Укажите дату занятия.");
      const format = input(form, "format") || "online";
      if (format !== "online" && format !== "offline" && format !== "self") return reject("Выберите формат занятия.");
      const recording = input(form, "recording");
      const settings: LessonSettings = {
        format, duration: integer(input(form, "duration") || "90", 5, 480),
        location: format === "offline" ? required(form, "location", 300) : "",
        recording: format === "online" && recording ? https(recording) : ""
      };
      const meeting = format === "online" ? https(required(form, "meeting", 2048)) : "";
      if (action === "reschedule") {
        const updated = await first("UPDATE assignments a SET starts=$3,meeting=$4,settings=$5 FROM groups g WHERE a.group_id=g.id AND a.id=$1 AND g.curator=$2 RETURNING a.id", [assignmentParam, user.id, date + "+03:00", meeting, json(settings)]);
        if (!updated) reject("Занятие недоступно.");
      } else {
        const group = await groupForCurator(input(form, "group"), user.id);
        const level = input(form, "level");
        const program = await first<ProgramRow>("SELECT * FROM programs WHERE level=$1 AND published IS NOT NULL", [level]);
        const lesson = program?.published?.lessons[integer(input(form, "lesson"), 0, 29)] ?? reject("Выберите опубликованное занятие.");
        await rows("INSERT INTO assignments(id,group_id,kind,level,content,starts,meeting,settings) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [randomUUID(), group.id, level === "diagnostic" ? "diagnostic" : "lesson", level, json(lesson), date + "+03:00", meeting, json(settings)]);
      }
    } else if (action === "attendance" && user.role === "curator") {
      const assignment = input(form, "assignment");
      const student = input(form, "student");
      const scope = await first("SELECT 1 FROM assignments a JOIN groups g ON g.id=a.group_id JOIN members m ON m.group_id=g.id WHERE a.id=$1 AND g.curator=$2 AND m.student=$3", [assignment, user.id, student]);
      if (!scope) reject("Ученик или занятие недоступны.");
      if (input(form, "attended") === "yes") {
        await rows("INSERT INTO attendance VALUES ($1,$2) ON CONFLICT DO NOTHING", [assignment, student]);
      } else {
        await rows("DELETE FROM attendance WHERE assignment=$1 AND student=$2", [assignment, student]);
      }
    } else if (action === "goal" && user.role === "student") {
      const diagnostic = await first<ProgramRow>("SELECT * FROM programs WHERE level='diagnostic'");
      const goal = required(form, "goal", 120);
      if (goal !== diagnostic?.published?.olympiad) reject("Выберите олимпиаду пилота.");
      await rows("UPDATE accounts SET goal=$1 WHERE id=$2", [goal, user.id]);
    } else if (action === "submit" && user.role === "student") {
      const assignment = await first<Assignment>("SELECT a.* FROM assignments a JOIN members m ON m.group_id=a.group_id WHERE a.id=$1 AND m.student=$2", [input(form, "assignment"), user.id]);
      if (!assignment) return reject("Работа недоступна.");
      if (!user.goal) reject("Сначала укажите целевую олимпиаду.");
      const tasks = work ? workTasks(assignment, work) : [];
      if (!tasks.length) reject("Работа недоступна.");
      const documents: (Attachment & { mime: string; bytes: Buffer })[] = [];
      const answers: NonNullable<Submission["answers"]> = {};
      let size = 0;
      for (const { index: task, task: definition } of tasks) {
        if (definition.response === "text") {
          answers[task] = required(form, "answer." + task, 12000);
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
        const latest = await first<Assignment>("SELECT a.* FROM assignments a JOIN members m ON m.group_id=a.group_id WHERE a.id=$1 AND m.student=$2 FOR UPDATE OF a", key, connection);
        if (!latest || String(latest.revision) !== input(form, "revision")) reject("Материалы изменились. Откройте работу заново.");
        await rows("INSERT INTO submissions(assignment,student,files) VALUES ($1,$2,'[]') ON CONFLICT DO NOTHING", key, connection);
        const current = await first<Submission>("SELECT * FROM submissions WHERE assignment=$1 AND student=$2 FOR UPDATE", key, connection);
        if (workState(tasks, current) !== "pending") reject("Работа уже сдана.");
        const files = [...(current?.files ?? []), ...documents.map(({ id, name, task }) => ({ id, name, task }))];
        await rows("UPDATE submissions SET files=$3,answers=$4 WHERE assignment=$1 AND student=$2", [...key, json(files), json({ ...current?.answers, ...answers })], connection);
        for (const file of documents) {
          await rows("INSERT INTO attachments VALUES ($1,$2,$3,$4,$5,$6)", [file.id, user.id, assignment.id, file.name, file.mime, file.bytes], connection);
        }
      });
    } else if (action === "grade" && user.role === "curator") {
      const student = input(form, "student");
      const assignment = await first<Assignment>("SELECT a.* FROM assignments a JOIN groups g ON g.id=a.group_id JOIN members m ON m.group_id=g.id WHERE a.id=$1 AND g.curator=$2 AND m.student=$3", [input(form, "assignment"), user.id, student]);
      if (!assignment) return reject("Работа недоступна.");
      const tasks = work ? workTasks(assignment, work) : [];
      if (!tasks.length) reject("Работа недоступна.");
      const grades = tasks.map(({ task, index }) => ({
        index, score: integer(input(form, "score." + index), 0, task.max),
        comment: required(form, "comment." + index, 3000)
      }));
      await transaction(async connection => {
        const key = [assignment.id, student];
        const current = await first<Submission>("SELECT * FROM submissions WHERE assignment=$1 AND student=$2 FOR UPDATE", key, connection);
        if (!current || workState(tasks, current) === "pending") return reject("Ученик ещё не сдал работу.");
        const merged = assignment.content.tasks.map((_, index) => current.grades?.[index] ?? null);
        for (const { index, score, comment } of grades) merged[index] = { score, comment };
        await rows("UPDATE submissions SET grades=$3 WHERE assignment=$1 AND student=$2", [...key, json(merged)], connection);
      });
    } else if (action === "trajectory" && user.role === "curator") {
      const student = input(form, "student");
      const diagnosis = await first<{ content: Assignment["content"]; grades: Grade[] }>(
        "SELECT a.content,s.grades FROM submissions s JOIN assignments a ON a.id=s.assignment JOIN groups g ON g.id=a.group_id JOIN members m ON m.group_id=g.id AND m.student=s.student WHERE g.curator=$1 AND s.student=$2 AND a.kind='diagnostic' AND s.grades IS NOT NULL ORDER BY a.starts DESC,a.id DESC LIMIT 1",
        [user.id, student]);
      const programs = await rows<ProgramRow>("SELECT * FROM programs");
      if (!diagnosis || !recommendation(diagnosis.content.tasks, diagnosis.grades, programs)) reject("Сначала проверьте диагностику.");
      const level = input(form, "level");
      const available = new Set(programs.find(p => p.level === level)?.published?.lessons.map(l => l.topic));
      for (const task of diagnosis!.content.tasks) available.add(task.topic);
      if (!programs.some(p => p.level === level && p.level !== "diagnostic" && p.published)) reject("Сначала опубликуйте учебную программу.");
      const topics: Topic[] = [];
      const count = integer(input(form, "topicCount"), 1, 24);
      for (let i = 0; i < count; i++) {
        const name = required(form, "topic." + i, 100);
        const due = required(form, "due." + i, 10);
        if (!available.has(name) || topics.some(topic => topic.name === name)) reject("Темы должны быть уникальными и входить в программу или диагностику.");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || !Number.isFinite(Date.parse(due)) || new Date(due).toISOString().slice(0,10) !== due) reject("Укажите срок по каждой теме.");
        topics.push({ name, due });
      }
      await rows("INSERT INTO trajectories(student,level,topics) VALUES ($1,$2,$3) ON CONFLICT(student) DO UPDATE SET level=$2,topics=$3,published=now()", [student, level, json(topics)]);
    } else {
      reject("Действие недоступно.");
    }
  } catch (error) {
    if (!(error instanceof InputError)) {
      console.error(error);
    }
    const message = error instanceof InputError ? error.message : "Не удалось сохранить. Повторите попытку.";
    redirect(back + (back.includes("?") ? "&" : "?") + "error=" + encodeURIComponent(message));
  }
  redirect(back + (back.includes("?") ? "&" : "?") + "saved=1");
}
