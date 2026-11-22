import { setTimeout as wait } from "node:timers/promises";
import { rows } from "./db";
import { claimTelegramJob, deliverTelegramJob, enqueueReminders, linkTelegram } from "./telegram-data";

type Update = { update_id: number; message?: { text?: string; chat: { id: number; type: string } } };
type TelegramResponse<T> = { ok: true; result: T } | { ok: false; error_code?: number; parameters?: { retry_after?: number } };

declare global {
  var olimpikTelegramWorker: boolean | undefined;
}

export function startTelegramWorker(token: string) {
  if (globalThis.olimpikTelegramWorker) return;
  globalThis.olimpikTelegramWorker = true;
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    console.warn("Telegram: проверьте формат TELEGRAM_BOT_TOKEN.");
    return;
  }
  const endpoint = "https://api.telegram.org/bot" + token + "/";
  async function api<T>(method: "getMe" | "getUpdates" | "sendMessage", body: object, timeout: number): Promise<TelegramResponse<T>> {
    try {
      const reply = await fetch(endpoint + method, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        cache: "no-store", signal: AbortSignal.timeout(timeout)
      });
      const result = await reply.json();
      return typeof result?.ok === "boolean" ? result : { ok: false };
    } catch {
      // Network exception messages can contain the Bot API URL and its token.
      return { ok: false };
    }
  }

  async function sendMessage(chatId: string, body: string): Promise<"sent" | "failed" | { retry: number }> {
    const text = Array.from(body).slice(0, 3900).join("");
    const result = await api("sendMessage", { chat_id: chatId, text, protect_content: true }, 7000);
    if (result.ok) return "sent";
    if (result.error_code === 429) return { retry: Math.max(1, Math.min(3600, result.parameters?.retry_after || 5)) };
    console.warn("Telegram: сообщение не подтверждено" + (result.error_code ? " (код " + result.error_code + ")." : "."));
    return "failed";
  }

  async function handle(update: Update) {
    const message = update.message;
    if (!message?.text || message.chat.type !== "private" || !Number.isSafeInteger(message.chat.id)) return;
    const start = /^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{32}))?$/i.exec(message.text.trim());
    if (!start) return;
    const chatId = String(message.chat.id);
    if (!start[1]) {
      await sendMessage(chatId, "Откройте профиль ученика в Olimpik, создайте код и пришлите команду /start КОД.");
      return;
    }
    const linked = await linkTelegram(start[1], chatId);
    await sendMessage(chatId, linked === "linked" ? "Telegram подключён к Olimpik. Здесь будут уведомления об уроках и домашних заданиях." :
      linked === "conflict" ? "Аккаунт Olimpik или этот чат уже подключён. Сначала отвяжите прежнюю связь в кабинете." :
        "Код недействителен или истёк. Создайте новый в профиле Olimpik.");
  }

  async function updates() {
    let offset: number | undefined;
    let lastError: string | undefined;
    while (true) {
      const reply = await api<Update[]>("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] }, 32_000);
      if (!reply.ok) {
        const status = String(reply.error_code || "network");
        if (status !== lastError) {
          console.warn(status === "409" ? "Telegram: getUpdates занят другим экземпляром бота или активен webhook." :
            "Telegram: getUpdates временно недоступен (" + status + ").");
          lastError = status;
        }
        if (reply.error_code === 401) return;
        await wait(Math.max(5, Math.min(3600, reply.parameters?.retry_after || 5)) * 1000, undefined, { ref: false });
        continue;
      }
      lastError = undefined;
      for (const update of reply.result) {
        try {
          await handle(update);
          offset = update.update_id + 1;
        } catch {
          console.warn("Telegram: не удалось обработать команду. Повторяем.");
          await wait(3000, undefined, { ref: false });
          break;
        }
      }
    }
  }

  async function reminders() {
    while (true) {
      try {
        await rows("UPDATE telegram_jobs SET status='failed' WHERE status='sending' AND available_at<now()-interval '2 minutes'");
        await enqueueReminders();
        for (let index = 0; index < 16; index++) {
          const job = await claimTelegramJob();
          if (!job) break;
          await deliverTelegramJob(job, sendMessage);
        }
      } catch {
        console.warn("Telegram: очередь уведомлений временно недоступна.");
      }
      await wait(5000, undefined, { ref: false });
    }
  }

  async function run() {
    while (true) {
      const info = await api<{ username?: string }>("getMe", {}, 7000);
      if (info.ok) {
        globalThis.olimpikTelegramUsername = info.result.username;
        break;
      }
      if (info.error_code === 401 || info.error_code === 404) {
        console.warn("Telegram: Bot API отклонил токен.");
        return;
      }
      console.warn("Telegram: Bot API недоступен. Повторим подключение.");
      await wait(15_000, undefined, { ref: false });
    }
    console.log("Telegram: включён long polling и очередь уведомлений.");
    void reminders();
    await updates();
  }

  void run().catch(() => console.warn("Telegram: long polling остановлен."));
}
