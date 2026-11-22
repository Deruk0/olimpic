import { first, rows, type Connection } from "./db";

export type TeacherCard = { id: string; name: string; subjects: string[]; description: string; hourly_rate: number };
type Slot = { id: string; starts: Date };
export const bookingStatuses = { pending: "Ожидает ответа", confirmed: "Подтверждена", declined: "Отклонена" };
export type BookingStatus = keyof typeof bookingStatuses;

export const teacherPath = (id: string) => "/teachers/" + encodeURIComponent(id);
export const bookingLoginPath = (id: string) => "/login?teacher=" + encodeURIComponent(id);
export const loginDestination = (teacher: unknown) =>
  typeof teacher === "string" && teacher.trim() && teacher.length <= 120 ? teacherPath(teacher) + "#booking" : "/cabinet";

const cardSelect = `SELECT a.id,a.name,p.subjects,p.description,p.hourly_rate
  FROM teacher_profiles p JOIN accounts a ON a.id=p.teacher_id
  WHERE p.hourly_rate IS NOT NULL AND cardinality(p.subjects)>0 AND p.description<>''`;

export function teacherCards() {
  return rows<TeacherCard>(cardSelect + " ORDER BY a.name,a.id");
}

export function teacherCard(id: string) {
  return first<TeacherCard>(cardSelect + " AND a.id=$1", [id]);
}

// Slots last 60 minutes. Check lessons as well as bookings before offering the time.
export const availableSlotCondition = `s.active AND s.starts>now()
  AND NOT EXISTS (SELECT 1 FROM booking_requests r WHERE r.slot_id=s.id AND r.status='confirmed')
  AND NOT EXISTS (
    SELECT 1 FROM assignments a WHERE a.teacher_id=s.teacher_id AND a.entry_kind='lesson' AND a.cancelled_at IS NULL
      AND a.starts < s.starts + interval '1 hour'
      AND a.starts + COALESCE((a.settings->>'duration')::int,60) * interval '1 minute' > s.starts
  )`;

export function availableSlots(teacherId: string, studentId?: string) {
  return rows<Slot>(`SELECT s.id,s.starts FROM teacher_slots s
    WHERE s.teacher_id=$1 AND ${availableSlotCondition}
      AND NOT EXISTS (SELECT 1 FROM booking_requests r WHERE r.slot_id=s.id AND r.student_id=$2)
    ORDER BY s.starts`, [teacherId, studentId ?? null]);
}

export function upcomingSlots(teacherId: string) {
  return rows<Slot & { booked: boolean; available: boolean }>(`SELECT s.id,s.starts,
    EXISTS(SELECT 1 FROM booking_requests r WHERE r.slot_id=s.id AND r.status='confirmed') AS booked,
    (${availableSlotCondition}) AS available
    FROM teacher_slots s WHERE s.teacher_id=$1 AND s.active AND s.starts>now() ORDER BY s.starts`, [teacherId]);
}

export function bookingRequests(id: string, role: "student" | "teacher") {
  return rows<{ id: string; starts: Date; teacher_id: string; name: string; status: BookingStatus; comment: string }>(
    `SELECT r.id,s.starts,s.teacher_id,a.name,r.status,r.comment
     FROM booking_requests r JOIN teacher_slots s ON s.id=r.slot_id
     JOIN accounts a ON a.id=${role === "teacher" ? "r.student_id" : "s.teacher_id"}
     WHERE ${role === "teacher" ? "s.teacher_id" : "r.student_id"}=$1
     ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END,r.created_at DESC,r.id`, [id]);
}

export async function lockTeacherBooking(teacher: string, connection: Connection) {
  return first<{ published: boolean }>(`SELECT
    (hourly_rate IS NOT NULL AND cardinality(subjects)>0 AND description<>'') AS published
    FROM teacher_profiles WHERE teacher_id=$1 FOR UPDATE`, [teacher], connection);
}
