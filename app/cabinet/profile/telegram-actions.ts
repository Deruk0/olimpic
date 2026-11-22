"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAccount } from "../../../lib/auth";
import { first, rows, transaction } from "../../../lib/db";
import { telegramCodeHash, telegramConfigured } from "../../../lib/telegram-data";

type TelegramResult = { code?: string; message?: string; error?: string };
const path = "/cabinet/profile";

export async function changeTelegram(_previous: TelegramResult, form: FormData): Promise<TelegramResult> {
  const student = await requireAccount("student");
  const action = form.get("action");
  if (action !== "unlink" && !telegramConfigured()) return { error: "Бот пока не настроен." };

  const result = await transaction(async connection => {
    await first("SELECT id FROM accounts WHERE id=$1 FOR UPDATE", [student.id], connection);
    if (action === "unlink") {
      await rows("DELETE FROM telegram_links WHERE student_id=$1", [student.id], connection);
      await rows("DELETE FROM telegram_link_codes WHERE student_id=$1", [student.id], connection);
      return { message: "Telegram отвязан." };
    }
    const link = await first<{ id: string }>("SELECT id FROM telegram_links WHERE student_id=$1", [student.id], connection);
    if (action === "code" && !link) {
      const code = randomBytes(24).toString("base64url");
      await rows(`INSERT INTO telegram_link_codes(student_id,hash,expires_at) VALUES ($1,$2,now()+interval '10 minutes')
        ON CONFLICT (student_id) DO UPDATE SET hash=EXCLUDED.hash,expires_at=EXCLUDED.expires_at`,
        [student.id, telegramCodeHash(code)], connection);
      return { code };
    }
    if (action === "test" && link) {
      if (await first(`SELECT 1 FROM telegram_jobs WHERE student_id=$1 AND link_id=$2 AND kind='test'
        AND created_at>now()-interval '15 seconds'`, [student.id, link.id], connection)) {
        return { error: "Подождите 15 секунд перед повторным тестом." };
      }
      await rows(`INSERT INTO telegram_jobs(id,student_id,link_id,kind,body) VALUES ($1,$2,$3,'test',$4)`,
        [randomUUID(), student.id, link.id, "Тестовое уведомление от Olimpik. Telegram подключён."], connection);
      return { message: "Тестовое уведомление добавлено в очередь." };
    }
    return { error: link ? "Telegram уже подключён." : "Сначала подключите Telegram." };
  });
  revalidatePath(path);
  return result;
}
