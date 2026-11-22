import { createHash, randomUUID } from "node:crypto";
import { first, rows, transaction, type Connection } from "./db";
import { formatLessonTime } from "./lesson-time";
import type { Assignment, Submission, WorkKind } from "./model";
import { workDeadline, workState, workTasks, workTitle } from "./work";

export const telegramConfigured = () => Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
declare global {
  var olimpikTelegramUsername: string | undefined;
}
export function telegramBotName() {
  const name = globalThis.olimpikTelegramUsername ?? process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  return name && /^[A-Za-z0-9_]{5,32}$/.test(name) ? name : null;
}
export const telegramCodeHash = (code: string) => createHash("sha256").update(code).digest("hex");
const lessonLeadMinutes = 20;
const deadlineLeadMinutes = 60;

export async function linkTelegram(code: string, chatId: string) {
  const hash = telegramCodeHash(code);
  return transaction(async connection => {
    const match = await first<{ student_id: string }>(
      "SELECT student_id FROM telegram_link_codes WHERE hash=$1 AND expires_at>now()", [hash], connection);
    if (!match) return "expired";
    await first("SELECT id FROM accounts WHERE id=$1 AND role='student' FOR UPDATE", [match.student_id], connection);
    if (!await first("SELECT 1 FROM telegram_link_codes WHERE student_id=$1 AND hash=$2 AND expires_at>now()", [match.student_id, hash], connection)) {
      return "expired";
    }
    const linked = await first(`INSERT INTO telegram_links(student_id,id,chat_id) VALUES ($1,$2,$3)
      ON CONFLICT DO NOTHING RETURNING id`, [match.student_id, randomUUID(), chatId], connection);
    if (!linked) return "conflict";
    await rows("DELETE FROM telegram_link_codes WHERE student_id=$1", [match.student_id], connection);
    return "linked";
  });
}

export async function enqueueReview(connection: Connection, student: string, assignment: string, kind: WorkKind, body: string) {
  if (!telegramConfigured()) return;
  await rows(`INSERT INTO telegram_jobs(id,student_id,link_id,kind,assignment_id,body)
    SELECT $1,student_id,id,'review',$2,$3 FROM telegram_links WHERE student_id=$4
    ON CONFLICT DO NOTHING`, [`review:${assignment}:${kind}`, assignment, body, student], connection);
}

export async function enqueueReminders() {
  // Discover jobs only as the reminder window opens. Reschedules get a new timestamp-based key.
  await rows(`INSERT INTO telegram_jobs(id,student_id,link_id,kind,assignment_id,event_at)
    SELECT 'lesson:' || a.id || ':' || extract(epoch FROM a.starts)::text,a.student_id,l.id,'lesson',a.id,a.starts
    FROM assignments a JOIN telegram_links l ON l.student_id=a.student_id
    WHERE a.entry_kind='lesson' AND a.cancelled_at IS NULL AND COALESCE(a.settings->>'format','online')<>'self'
      AND a.starts>now() AND a.starts<=now()+$1::int*interval '1 minute'
    ON CONFLICT (id) DO UPDATE SET status='queued',link_id=EXCLUDED.link_id,available_at=now()
    WHERE telegram_jobs.status='skipped'`, [lessonLeadMinutes]);

  await rows(`WITH deadlines AS (
    SELECT a.id,a.student_id,l.id AS link_id,COALESCE(a.due_at,
      CASE WHEN a.content#>>'{work,homework,dueDays}' ~ '^[0-9]{1,3}$'
        THEN a.starts+(a.content#>>'{work,homework,dueDays}')::int*interval '24 hours' END) AS due
    FROM assignments a JOIN telegram_links l ON l.student_id=a.student_id
  ) INSERT INTO telegram_jobs(id,student_id,link_id,kind,assignment_id,event_at)
    SELECT 'deadline:' || id || ':' || extract(epoch FROM due)::text,student_id,link_id,'deadline',id,due
    FROM deadlines WHERE due>now() AND due<=now()+$1::int*interval '1 minute' ON CONFLICT DO NOTHING`, [deadlineLeadMinutes]);
}

type TelegramJob = {
  id: string; student_id: string; link_id: string; kind: "lesson" | "deadline" | "review" | "test";
  assignment_id: string | null; event_at: Date | null; body: string | null;
};

export function claimTelegramJob() {
  return first<TelegramJob>(`UPDATE telegram_jobs SET status='sending',available_at=now()
    WHERE id=(SELECT id FROM telegram_jobs WHERE status='queued' AND available_at<=now()
      ORDER BY available_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id,student_id,link_id,kind,assignment_id,event_at,body`);
}

async function currentReminder(job: TelegramJob, connection: Connection) {
  const item = await first<Assignment>(
    "SELECT * FROM assignments WHERE id=$1 AND student_id=$2 FOR UPDATE", [job.assignment_id, job.student_id], connection);
  if (!item || !job.event_at) return null;
  const expected = new Date(job.event_at).getTime();
  if (expected <= Date.now()) return null;
  if (job.kind === "lesson") {
    if (item.entry_kind !== "lesson" || item.cancelled_at || item.settings.format === "self" ||
      new Date(item.starts).getTime() !== expected) return null;
    return "Скоро урок · " + item.content.title + "\nНачало: " + formatLessonTime(new Date(item.starts));
  }
  const due = workDeadline(item, "homework");
  if (!due || due.getTime() !== expected) return null;
  const tasks = workTasks(item, "homework");
  const submission = await first<Submission>("SELECT * FROM submissions WHERE assignment=$1 AND student=$2", [item.id, item.student_id], connection);
  if (!tasks.length || workState(tasks, submission) !== "pending") return null;
  return "Скоро срок сдачи · " + workTitle(item, "homework") + "\nДо " + formatLessonTime(due);
}

type Delivery = "sent" | "failed" | { retry: number };
export async function deliverTelegramJob(job: TelegramJob, send: (chatId: string, body: string) => Promise<Delivery>) {
  // Keep reschedules, cancellations, submissions and disconnects ordered with the final delivery check.
  // The claim is committed before making the external request so an uncertain result is never sent twice.
  await transaction(async connection => {
    const body = job.kind === "lesson" || job.kind === "deadline" ? await currentReminder(job, connection) : job.body;
    const link = body ? await first<{ chat_id: string }>(
      "SELECT chat_id FROM telegram_links WHERE student_id=$1 AND id=$2 FOR UPDATE", [job.student_id, job.link_id], connection) : undefined;
    const result = body && link ? await send(link.chat_id, body) : "skipped";
    if (typeof result === "object") {
      await rows("UPDATE telegram_jobs SET status='queued',available_at=now()+$2::int*interval '1 second' WHERE id=$1",
        [job.id, result.retry], connection);
    } else {
      await rows("UPDATE telegram_jobs SET status=$2 WHERE id=$1", [job.id, result], connection);
    }
  });
}
