"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { account, requireAccount } from "../lib/auth";
import { availableSlotCondition, bookingLoginPath, lockTeacherBooking, teacherPath, type BookingStatus } from "../lib/booking";
import { first, rows, transaction } from "../lib/db";
import { parseLessonTime } from "../lib/lesson-time";

const profilePath = "/cabinet/visit-card";
const requestsPath = "/cabinet/bookings";
const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
class BookingError extends Error {}

function failure(path: string, error: unknown): never {
  if (!(error instanceof BookingError)) console.error(error);
  const message = error instanceof BookingError ? error.message : "Не удалось сохранить. Попробуйте ещё раз.";
  redirect(path + "?error=" + encodeURIComponent(message));
}

function refreshBooking(teacher: string) {
  revalidatePath("/");
  revalidatePath(teacherPath(teacher));
  revalidatePath(profilePath);
  revalidatePath(requestsPath);
}

export async function saveVisitCard(form: FormData) {
  const teacher = await requireAccount("teacher");
  try {
    const unique = new Map<string, string>();
    for (const raw of field(form, "subjects").split(/\r?\n/)) {
      const name = raw.trim().replace(/\s+/g, " ");
      if (name) unique.set(name.toLocaleLowerCase("ru"), name);
    }
    const subjects = [...unique.values()];
    const description = field(form, "description");
    const rate = Number(field(form, "rate"));
    if (!subjects.length || subjects.length > 8 || subjects.some(name => name.length > 60)) {
      throw new BookingError("Укажите от 1 до 8 предметов, каждый до 60 символов.");
    }
    if (!description || description.length > 2000) throw new BookingError("Укажите описание до 2000 символов.");
    if (!Number.isInteger(rate) || rate < 1 || rate > 1_000_000) throw new BookingError("Укажите ставку целым числом от 1 до 1 000 000 ₽.");
    const updated = await first(`UPDATE teacher_profiles SET subjects=$2,subject=$3,description=$4,hourly_rate=$5
      WHERE teacher_id=$1 RETURNING teacher_id`, [teacher.id, subjects, subjects[0], description, rate]);
    if (!updated) throw new BookingError("Профиль преподавателя недоступен.");
  } catch (error) {
    failure(profilePath, error);
  }
  refreshBooking(teacher.id);
  redirect(profilePath + "?saved=1");
}

export async function addTeacherSlot(form: FormData) {
  const teacher = await requireAccount("teacher");
  try {
    const starts = parseLessonTime(field(form, "starts"));
    if (!starts || starts.getTime() <= Date.now()) throw new BookingError("Укажите будущую дату и время.");
    await transaction(async connection => {
      if (!(await lockTeacherBooking(teacher.id, connection))?.published) {
        throw new BookingError("Сначала заполните и сохраните визитку.");
      }
      const time = starts.toISOString();
      if (await first(`SELECT 1 FROM teacher_slots WHERE teacher_id=$1 AND active
        AND starts > $2::timestamptz - interval '1 hour' AND starts < $2::timestamptz + interval '1 hour'`,
        [teacher.id, time], connection)) throw new BookingError("Это время пересекается с другим окном.");
      const slot = await first<{ id: string }>(`INSERT INTO teacher_slots (id,teacher_id,starts) VALUES ($1,$2,$3)
        ON CONFLICT (teacher_id,starts) DO UPDATE SET active=true RETURNING id`,
        [randomUUID(), teacher.id, time], connection);
      if (!await first(`SELECT 1 FROM teacher_slots s WHERE s.id=$1 AND ${availableSlotCondition}`, [slot!.id], connection)) {
        throw new BookingError("Это время уже занято уроком или подтверждённой записью.");
      }
    });
  } catch (error) {
    failure(profilePath, error);
  }
  refreshBooking(teacher.id);
  redirect(profilePath + "?saved=1#windows");
}

export async function removeTeacherSlot(slot: string) {
  const teacher = await requireAccount("teacher");
  try {
    await transaction(async connection => {
      await lockTeacherBooking(teacher.id, connection);
      const changed = await first(`UPDATE teacher_slots s SET active=false WHERE s.id=$1 AND s.teacher_id=$2 AND s.active
        AND NOT EXISTS (SELECT 1 FROM booking_requests r WHERE r.slot_id=s.id AND r.status='confirmed') RETURNING s.id`,
        [slot, teacher.id], connection);
      if (!changed) throw new BookingError("Окно недоступно или уже подтверждено.");
      await rows("UPDATE booking_requests SET status='declined' WHERE slot_id=$1 AND status='pending'", [slot], connection);
    });
  } catch (error) {
    failure(profilePath, error);
  }
  refreshBooking(teacher.id);
  redirect(profilePath + "?saved=1#windows");
}

export async function requestBooking(teacher: string, form: FormData) {
  const student = await account();
  if (!student) redirect(bookingLoginPath(teacher));
  if (student.role !== "student") redirect(teacherPath(teacher));
  try {
    const slot = field(form, "slot");
    const comment = field(form, "comment");
    if (comment.length > 500) throw new BookingError("Комментарий должен быть не длиннее 500 символов.");
    await transaction(async connection => {
      if (!(await lockTeacherBooking(teacher, connection))?.published ||
        !await first(`SELECT 1 FROM teacher_slots s WHERE s.id=$1 AND s.teacher_id=$2 AND ${availableSlotCondition}`,
          [slot, teacher], connection)) throw new BookingError("Это окно уже недоступно. Выберите другое время.");
      const created = await first(`INSERT INTO booking_requests(id,slot_id,student_id,comment) VALUES ($1,$2,$3,$4)
        ON CONFLICT (slot_id,student_id) DO NOTHING RETURNING id`, [randomUUID(), slot, student.id, comment], connection);
      if (!created) throw new BookingError("Вы уже отправляли заявку на это время.");
    });
  } catch (error) {
    failure(teacherPath(teacher), error);
  }
  refreshBooking(teacher);
  redirect(teacherPath(teacher) + "?sent=1#booking");
}

export async function decideBooking(id: string, form: FormData) {
  const teacher = await requireAccount("teacher");
  try {
    const status = field(form, "decision") as BookingStatus;
    if (status !== "confirmed" && status !== "declined") throw new BookingError("Выберите действие с заявкой.");
    await transaction(async connection => {
      await lockTeacherBooking(teacher.id, connection);
      const request = await first<{ slot_id: string; student_id: string; available: boolean }>(
        `SELECT r.slot_id,r.student_id,(${availableSlotCondition}) AS available
         FROM booking_requests r JOIN teacher_slots s ON s.id=r.slot_id
         WHERE r.id=$1 AND s.teacher_id=$2 AND r.status='pending'`, [id, teacher.id], connection);
      if (!request) throw new BookingError("Заявка недоступна или уже обработана.");
      if (status === "confirmed" && !request.available) throw new BookingError("Окно уже недоступно. Отклоните заявку.");
      await rows("UPDATE booking_requests SET status=$2 WHERE id=$1", [id, status], connection);
      if (status === "confirmed") {
        await rows("INSERT INTO teacher_students(teacher_id,student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [teacher.id, request.student_id], connection);
        await rows("UPDATE booking_requests SET status='declined' WHERE slot_id=$1 AND status='pending'", [request.slot_id], connection);
      }
    });
  } catch (error) {
    failure(requestsPath, error);
  }
  refreshBooking(teacher.id);
  revalidatePath("/cabinet/students");
  revalidatePath("/cabinet/profile");
  redirect(requestsPath + "?saved=1");
}
