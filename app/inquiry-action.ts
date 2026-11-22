"use server";

import { randomUUID } from "node:crypto";
import { hash } from "../lib/auth";
import { rows } from "../lib/db";
import { canAcceptInquiries } from "../lib/inquiry-access";

export type InquiryResult = { status: "idle" | "error" | "success"; message: string };

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function submitInquiry(_: InquiryResult, form: FormData): Promise<InquiryResult> {
  const error = (message: string): InquiryResult => ({ status: "error", message });
  if (!canAcceptInquiries()) return error("Приём заявок пока закрыт.");
  if (text(form, "website")) return error("Не удалось отправить заявку. Попробуйте ещё раз.");

  const name = text(form, "name").replace(/\s+/g, " ");
  const grade = text(form, "grade");
  const rawPhone = text(form, "phone");
  const email = text(form, "email").toLowerCase();
  const digits = rawPhone.replace(/\D/g, "");

  if (!name || name.length > 80) return error("Укажите имя длиной до 80 символов.");
  if (grade && !["8", "9", "other"].includes(grade)) return error("Выберите класс из списка.");
  if (!rawPhone && !email) return error("Укажите телефон или электронную почту.");
  if (rawPhone && (rawPhone.length > 32 || !/^\+?[\d\s().-]+$/.test(rawPhone) || !/^\d{10,15}$/.test(digits))) {
    return error("Проверьте номер телефона. Можно указать номер с кодом страны.");
  }
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return error("Проверьте адрес электронной почты.");
  }
  if (form.get("consent") !== "yes") return error("Подтвердите согласие, чтобы мы могли связаться с вами.");

  const phone = digits.length === 11 && digits.startsWith("8") && !rawPhone.startsWith("+")
    ? "+7" + digits.slice(1)
    : digits ? "+" + (digits.length === 10 && !rawPhone.startsWith("+") ? "7" : "") + digits : null;
  const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
  const submissionKey = hash(JSON.stringify([name.toLowerCase(), grade, phone, email, bucket]));
  try {
    await rows(
      `INSERT INTO school_inquiries (id, submission_key, name, school_grade, phone, email)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (submission_key) DO NOTHING`,
      [randomUUID(), submissionKey, name, grade || null, phone, email || null],
    );
  } catch {
    return error("Не удалось сохранить заявку. Попробуйте ещё раз чуть позже.");
  }
  return { status: "success", message: "Спасибо! Мы свяжемся с вами по указанным контактам." };
}
