const display = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Moscow" });
const date = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Moscow" });
const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });

export const roomEarlyAccess = 15 * 60_000;
export function lessonEnd(starts: number, duration?: number) {
  return starts + (duration ?? 90) * 60_000;
}

export function formatLessonTime(value: Date) {
  return display.format(new Date(value)) + " МСК";
}

export function lessonTimeInput(value: Date) {
  return date.format(new Date(value)) + "T" + clock.format(new Date(value));
}

export function parseLessonTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const utc = new Date(value + "Z");
  if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 16) !== value) return null;
  return new Date(value + "+03:00");
}
