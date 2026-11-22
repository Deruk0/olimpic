"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { changeTelegram } from "./telegram-actions";

const deliveryLabels = {
  queued: "В очереди",
  sending: "Отправляется",
  sent: "Отправлено",
  failed: "Не удалось подтвердить доставку",
  skipped: "Отменено"
};
export type TelegramDelivery = keyof typeof deliveryLabels;

export function TelegramSettings({ enabled, linked, botName, test }: {
  enabled: boolean; linked: boolean; botName: string | null; test: TelegramDelivery | null;
}) {
  const [result, action, pending] = useActionState(changeTelegram, {});
  const router = useRouter();
  const canRefresh = !!result.code || (linked && enabled);
  return <section className="panel" id="telegram">
    <h2>Telegram</h2>
    <div className="profile-telegram-body">
      <p className={linked ? "badge badge-success" : "badge badge-neutral"}>{linked ? "Telegram подключён" : "Telegram не подключён"}</p>
      {!enabled && <p className="muted">Уведомления пока не настроены.</p>}
      {enabled && !linked && <p>Подключите бота, чтобы получать напоминания и результаты проверки.</p>}
      {(linked || enabled) && <form action={action} className="controls">
        {linked ? <>
          {enabled && <button name="action" value="test" disabled={pending}>Отправить тестовое уведомление</button>}
          <button className="secondary" name="action" value="unlink" disabled={pending}>Отвязать Telegram</button>
        </> : <button name="action" value="code" disabled={pending}>{result.code ? "Создать новый код" : "Создать код привязки"}</button>}
      </form>}
      {!linked && result.code && <>
        <p>{botName ? "Отправьте эту команду боту." : "Откройте в Telegram бота, созданного через BotFather, и отправьте ему команду."} Код действует 10 минут и используется один раз.</p>
        <p><code style={{ overflowWrap: "anywhere" }}>/start {result.code}</code></p>
        {botName && <p><a href={"https://t.me/" + botName + "?start=" + result.code} target="_blank" rel="noopener noreferrer">Открыть бота в Telegram ↗</a></p>}
      </>}
      {result.error && <p className="notice error" role="alert">{result.error}</p>}
      {result.message && <p className="notice" role="status">{result.message}</p>}
      {(canRefresh || (linked && test)) && <div className="profile-telegram-footer">
        {linked && test && <p className="muted">Последний тест · {deliveryLabels[test]}</p>}
        {canRefresh && <button type="button" className="secondary" onClick={() => router.refresh()}>Обновить статус</button>}
      </div>}
    </div>
  </section>;
}
