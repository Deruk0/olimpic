"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { account } from "../lib/auth";
import { first, rows, transaction } from "../lib/db";

export async function deleteAssignedLesson(_previous: { error: string }, form: FormData) {
  const user = await account();
  if (user?.role !== "curator") return { error: "Удаление занятия недоступно." };
  const id = String(form.get("assignment") ?? "");
  if (!id || form.get("confirm") !== id) return { error: "Подтвердите удаление занятия." };
  try {
    const found = await transaction(async connection => {
      const assignment = await first<{ deleted_at: Date | null }>(
        "SELECT a.deleted_at FROM assignments a JOIN groups g ON g.id=a.group_id WHERE a.id=$1 AND g.curator=$2 FOR UPDATE OF a",
        [id, user.id], connection);
      if (!assignment) return false;
      if (!assignment.deleted_at) await rows("UPDATE assignments SET deleted_at=now(),revision=revision+1 WHERE id=$1", [id], connection);
      return true;
    });
    if (!found) return { error: "Занятие недоступно." };
  } catch {
    return { error: "Не удалось удалить занятие. Повторите попытку." };
  }
  revalidatePath("/cabinet", "layout");
  redirect("/cabinet?view=schedule&deleted=1");
}
