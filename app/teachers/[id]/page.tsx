import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { account } from "../../../lib/auth";
import { availableSlots, bookingLoginPath, teacherCard, teacherPath } from "../../../lib/booking";
import { formatLessonTime } from "../../../lib/lesson-time";
import { requestBooking } from "../../booking-actions";
import { Submit } from "../../components";
import { HourlyRate, PublicHeader, TeacherIdentity, TeacherSubjects } from "../../teacher-public";
import styles from "../../teachers.module.css";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string; error?: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { id } = await params;
  const teacher = await teacherCard(id);
  return teacher ? { title: teacher.name + " · Olimpik", description: teacher.description.slice(0, 160),
    alternates: { canonical: teacherPath(id) } } : { title: "Преподаватель · Olimpik" };
}

export default async function TeacherPage({ params, searchParams }: Props) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, account()]);
  const teacher = await teacherCard(id);
  if (!teacher) notFound();
  const isStudent = user?.role === "student";
  const slots = await availableSlots(id, isStudent ? user.id : undefined);

  return <div className={styles.publicPage}>
    <PublicHeader signedIn={!!user} />
    <main className={styles.container}>
      <p className={styles.back}><Link href="/">← Все преподаватели</Link></p>
      <div className={styles.profile}>
        <section className={styles.profileCard}>
          <TeacherIdentity name={teacher.name} subject={teacher.subjects[0]} />
          <h1>{teacher.name}</h1>
          <TeacherSubjects subjects={teacher.subjects} />
          {slots.length > 0 && (!user || isStudent) && <a className={styles.mobileBooking} href="#booking">Выбрать время ↓</a>}
          <div className={styles.bio}>
            <h2>О преподавателе</h2>
            <p>{teacher.description}</p>
          </div>
        </section>
        <section className={styles.booking} id="booking" aria-labelledby="booking-title">
          <h2 id="booking-title">Записаться на занятие</h2>
          <HourlyRate rate={teacher.hourly_rate} />
          <p className={styles.muted}>Оплата напрямую преподавателю.</p>
          {query.sent === "1" && <p className="notice" role="status">Заявка отправлена. Ответ появится в «Моих заявках».</p>}
          {typeof query.error === "string" && <p className="notice error" role="alert">{query.error}</p>}
          {slots.length ? isStudent ? <form className={styles.bookingForm} action={requestBooking.bind(null, id)}>
            <fieldset>
              <legend>Выберите свободное время</legend>
              {slots.map(slot => <label className={styles.slot} key={slot.id}>
                <input type="radio" name="slot" value={slot.id} required />
                <time dateTime={new Date(slot.starts).toISOString()}>{formatLessonTime(slot.starts)}</time>
              </label>)}
            </fieldset>
            <label className={styles.comment}>Комментарий <span>· необязательно</span>
              <textarea name="comment" rows={3} maxLength={500} placeholder="Например, к какому экзамену готовитесь" />
            </label>
            <Submit pendingLabel="Отправляем…">Записаться</Submit>
          </form> : <>
            {!user && <Link className={styles.primary} href={bookingLoginPath(id)}>Войти, чтобы записаться</Link>}
            <h3 className={styles.slotTitle}>Свободные окна</h3>
            <ul className={styles.slotList}>{slots.map(slot => <li className={styles.slot} key={slot.id}>
              <time dateTime={new Date(slot.starts).toISOString()}>{formatLessonTime(slot.starts)}</time>
            </li>)}</ul>
          </> : <p className={styles.noSlots}>Доступных окон для записи пока нет.</p>}
          {isStudent && <p className={styles.bookingLink}><Link href="/cabinet/bookings">Мои заявки →</Link></p>}
          {user?.id === id && <Link className={styles.outline} href="/cabinet/visit-card">Редактировать визитку</Link>}
        </section>
      </div>
    </main>
  </div>;
}
