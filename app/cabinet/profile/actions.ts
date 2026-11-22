"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "../../../lib/auth";
import { rows, transaction } from "../../../lib/db";
import { materialImageType } from "../../../lib/material-image";
import { isThemeMode, isThemePalette } from "../../../lib/theme";

const profilePath = "/cabinet/profile";

function profileError(message: string): never {
  redirect(profilePath + "?error=" + encodeURIComponent(message));
}

export async function saveProfileTheme(setting: unknown, value: unknown) {
  const user = await requireAccount();
  const sql = setting === "mode" && isThemeMode(value) ? "UPDATE accounts SET theme=$1 WHERE id=$2"
    : setting === "palette" && isThemePalette(value) ? "UPDATE accounts SET theme_palette=$1 WHERE id=$2" : null;
  if (!sql) return { error: "Проверьте выбранную тему." };

  await rows(sql, [value, user.id]);
  revalidatePath("/", "layout");
  return { error: null };
}

export async function saveProfile(form: FormData) {
  const user = await requireAccount();
  const name = form.get("name");
  if (typeof name !== "string" || !name.trim() || name.trim().length > 120 || /[\r\n\p{Cc}]/u.test(name)) {
    profileError("Введите имя и фамилию длиной до 120 символов.");
  }

  const file = form.get("avatar");
  let avatar: Buffer | undefined;
  if (file instanceof File && file.size) {
    if (file.size > 2_000_000) profileError("Размер фото должен быть до 2 МБ.");
    avatar = Buffer.from(await file.arrayBuffer());
    const type = materialImageType(avatar);
    if (type !== "image/jpeg" && type !== "image/png" && type !== "image/webp") {
      profileError("Выберите фото в формате JPEG, PNG или WebP.");
    }
  }

  await transaction(async connection => {
    await rows("UPDATE accounts SET name=$1 WHERE id=$2", [name.trim().replace(/\s+/g, " "), user.id], connection);
    if (avatar) {
      await rows("INSERT INTO account_avatars(account,version,bytes) VALUES ($1,$2,$3) ON CONFLICT(account) DO UPDATE SET version=EXCLUDED.version,bytes=EXCLUDED.bytes",
        [user.id, randomUUID(), avatar], connection);
    }
  });
  revalidatePath("/", "layout");
  redirect(profilePath + "?saved=1");
}

export async function removeProfileAvatar() {
  const user = await requireAccount();
  await rows("DELETE FROM account_avatars WHERE account=$1", [user.id]);
  revalidatePath("/", "layout");
  redirect(profilePath + "?saved=1");
}

export async function detachLearningContact(contactId: string) {
  const user = await requireAccount();
  const pair = user.role === "teacher" ? [user.id, contactId] : [contactId, user.id];
  await rows("DELETE FROM teacher_students WHERE teacher_id=$1 AND student_id=$2", pair);
  revalidatePath(profilePath);
  redirect(profilePath + "?saved=1#learning-contacts");
}
