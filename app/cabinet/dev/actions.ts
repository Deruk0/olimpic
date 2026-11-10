"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { account, hash, token } from "../../../lib/auth";
import { first, rows, transaction } from "../../../lib/db";

export type DevResult = { error: string; message?: string; code?: string };
const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export async function createManagedAccount(_previous: DevResult, form: FormData): Promise<DevResult> {
  if ((await account())?.role !== "methodist") return { error: "Управление аккаунтами недоступно." };
  const name = text(form, "name");
  const role = text(form, "role");
  const group = text(form, "group");
  if (!name || name.length > 120) return { error: "Введите имя длиной до 120 символов." };
  if (role !== "student" && role !== "curator" && role !== "methodist") return { error: "Выберите роль аккаунта." };
  try {
    const created = await transaction(async connection => {
      if (role === "student" && group && !await first("SELECT id FROM groups WHERE id=$1", [group], connection)) return false;
      const id = randomUUID();
      await rows("INSERT INTO accounts(id,name,role) VALUES ($1,$2,$3)", [id, name, role], connection);
      if (role === "student" && group) await rows("INSERT INTO members(student,group_id) VALUES ($1,$2)", [id, group], connection);
      return true;
    });
    if (!created) return { error: "Выбранная группа недоступна." };
  } catch {
    return { error: "Не удалось создать аккаунт. Повторите попытку." };
  }
  revalidatePath("/cabinet", "layout");
  return { error: "", message: "Аккаунт «" + name + "» создан. Выдайте ему код входа в разделе приглашений." };
}

export async function createManagedGroup(_previous: DevResult, form: FormData): Promise<DevResult> {
  if ((await account())?.role !== "methodist") return { error: "Управление группами недоступно." };
  const name = text(form, "name");
  const curator = text(form, "curator");
  if (!name || name.length > 120) return { error: "Введите название группы длиной до 120 символов." };
  try {
    const created = await first("INSERT INTO groups(id,name,curator) SELECT $1,$2,id FROM accounts WHERE id=$3 AND role='curator' RETURNING id", [randomUUID(), name, curator]);
    if (!created) return { error: "Выберите действующий аккаунт куратора." };
  } catch {
    return { error: "Не удалось создать группу. Повторите попытку." };
  }
  revalidatePath("/cabinet", "layout");
  return { error: "", message: "Группа «" + name + "» создана." };
}

export async function issueManagedInvite(_previous: DevResult, form: FormData): Promise<DevResult> {
  if ((await account())?.role !== "methodist") return { error: "Выдача приглашений недоступна." };
  const id = text(form, "account");
  const code = token();
  try {
    const recipient = await first<{ name: string }>("SELECT name FROM accounts WHERE id=$1", [id]);
    if (!recipient) return { error: "Выберите существующий аккаунт." };
    await rows("INSERT INTO invites(hash,account,expires) VALUES ($1,$2,now()+interval '7 days')", [hash(code), id]);
    return { error: "", message: "Код для «" + recipient.name + "» действует 7 дней и подходит для одного входа.", code };
  } catch {
    return { error: "Не удалось выдать приглашение. Повторите попытку." };
  }
}

export async function enrollManagedStudent(_previous: DevResult, form: FormData): Promise<DevResult> {
  if ((await account())?.role !== "methodist") return { error: "Управление группами недоступно." };
  const student = text(form, "student");
  const group = text(form, "group");
  try {
    const added = await first("INSERT INTO members(student,group_id) SELECT a.id,g.id FROM accounts a CROSS JOIN groups g WHERE a.id=$1 AND a.role='student' AND g.id=$2 ON CONFLICT(student) DO NOTHING RETURNING student", [student, group]);
    if (!added && !await first("SELECT student FROM members WHERE student=$1 AND group_id=$2", [student, group])) {
      return { error: "Выберите ученика без группы и существующую группу." };
    }
  } catch {
    return { error: "Не удалось добавить ученика в группу. Повторите попытку." };
  }
  revalidatePath("/cabinet", "layout");
  return { error: "", message: "Ученик добавлен в группу." };
}
