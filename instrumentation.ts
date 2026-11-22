export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return;
  const { startTelegramWorker } = await import("./lib/telegram-worker");
  startTelegramWorker(token);
}
