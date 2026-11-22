import Link from "next/link";
import { requireAccount } from "../../../lib/auth";
import { teacherPath, upcomingSlots } from "../../../lib/booking";
import { first } from "../../../lib/db";
import { formatLessonTime } from "../../../lib/lesson-time";
import { addTeacherSlot, removeTeacherSlot, saveVisitCard } from "../../booking-actions";
import { DateField } from "../../date-field";
import { Submit } from "../../components";
import { CabinetFrame } from "../frame";

export default async function VisitCardPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const teacher = await requireAccount("teacher");
  const [query, profile, slots] = await Promise.all([
    searchParams,
    first<{ subject: string; subjects: string[]; description: string; hourly_rate: number | null }>(
      "SELECT subject,subjects,description,hourly_rate FROM teacher_profiles WHERE teacher_id=$1", [teacher.id]),
    upcomingSlots(teacher.id)
  ]);
  const published = !!profile?.hourly_rate && !!profile.description && profile.subjects.length > 0;
  return <CabinetFrame user={teacher} view="visit-card" title="Моя визитка" saved={query.saved} error={query.error}>
    <section className="panel">
      <div className="split">
        <h2>Публичный профиль</h2>
        {published && <Link className="button secondary" href={teacherPath(teacher.id)}>Открыть визитку</Link>}
      </div>
      <form className="editor" action={saveVisitCard}>
        <label>Предметы<textarea name="subjects" rows={3} required maxLength={488}
          defaultValue={profile?.subjects.length ? profile.subjects.join("\n") : profile?.subject} />
          <small>Один предмет на строку.</small>
        </label>
        <label>Описание<textarea name="description" rows={6} required maxLength={2000} defaultValue={profile?.description}
          placeholder="Расскажите об опыте и о том, к чему готовите учеников." /></label>
        <label>Ставка за 60 минут, ₽<input name="rate" type="number" required min={1} max={1000000} step={1}
          defaultValue={profile?.hourly_rate ?? undefined} /></label>
        <Submit>{published ? "Сохранить визитку" : "Опубликовать визитку"}</Submit>
      </form>
    </section>
    <section id="windows" className="panel">
      <h2>Окна для записи</h2>
      <p className="muted">Каждое окно длится 60 минут. Время указано по Москве.</p>
      {slots.length > 0 && <div className="roster">{slots.map(slot => <div className="split" key={slot.id}>
        <time dateTime={new Date(slot.starts).toISOString()}>{formatLessonTime(slot.starts)}</time>
        {slot.booked ? <span className="badge badge-success">Подтверждено</span> :
          <div className="controls">
            <span className="badge badge-neutral">{slot.available ? "Свободно" : "Занято уроком"}</span>
            <form action={removeTeacherSlot.bind(null, slot.id)}><Submit secondary>Убрать окно</Submit></form>
          </div>}
      </div>)}</div>}
      {published ? <form className="editor" action={addTeacherSlot}>
        <DateField name="starts" label="Начало окна (МСК)" withTime />
        <Submit>Добавить окно</Submit>
      </form> : <p>Опубликуйте визитку, чтобы добавить окна.</p>}
    </section>
  </CabinetFrame>;
}
