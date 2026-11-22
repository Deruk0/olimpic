import { first, type Connection } from "./db";
import { lessonEnd, roomEarlyAccess } from "./lesson-time";
import type { LessonSettings, Role } from "./model";

export async function roomLesson(id: string, user: { id: string; role: Role }, connection?: Connection) {
  const lesson = await first<{ title: string; peer_name: string; peer_id: string; starts: Date; settings: Partial<LessonSettings> }>(
    `SELECT a.content->>'title' AS title,p.name AS peer_name,p.id AS peer_id,a.starts,a.settings
     FROM assignments a JOIN accounts p ON p.id=CASE WHEN $3='teacher' THEN a.student_id ELSE a.teacher_id END
     WHERE a.id=$1 AND a.entry_kind='lesson' AND a.cancelled_at IS NULL AND COALESCE(a.settings->>'format','online')='online'
       AND (CASE WHEN $3='teacher' THEN a.teacher_id ELSE a.student_id END)=$2${connection ? " FOR UPDATE OF a" : ""}`,
    [id, user.id, user.role], connection);
  if (!lesson) return null;
  const ts = new Date(lesson.starts).getTime();
  return { ...lesson, opens: ts - roomEarlyAccess, closes: lessonEnd(ts, lesson.settings.duration) };
}

export function roomIceServers(): RTCIceServer[] {
  const stun = process.env.OLIMPIK_STUN_URL ?? "stun:stun.l.google.com:19302";
  const turn = process.env.OLIMPIK_TURN_URL;
  const username = process.env.OLIMPIK_TURN_USERNAME;
  const credential = process.env.OLIMPIK_TURN_CREDENTIAL;
  const servers: RTCIceServer[] = [];
  if (stun.startsWith("stun:")) servers.push({ urls: stun });
  if (turn && /^turns?:/.test(turn) && username && credential) servers.push({ urls: turn, username, credential });
  return servers;
}
