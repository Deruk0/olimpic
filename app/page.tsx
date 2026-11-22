import type { Metadata } from "next";
import Link from "next/link";
import { account } from "../lib/auth";
import { teacherCards, teacherPath } from "../lib/booking";
import { HourlyRate, PublicHeader, TeacherIdentity, TeacherSubjects } from "./teacher-public";
import styles from "./teachers.module.css";

export const metadata: Metadata = {
  title: "Преподаватели · Olimpik",
  description: "Найдите преподавателя по предмету, сравните ставки и выберите время занятия.",
  alternates: { canonical: "/" }
};

export default async function Catalog({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const [query, teachers, user] = await Promise.all([searchParams, teacherCards(), account()]);
  const key = (value: string) => value.toLocaleLowerCase("ru");
  const subjects = [...new Map(teachers.flatMap(teacher => teacher.subjects).map(subject => [key(subject), subject])).values()]
    .sort((a, b) => a.localeCompare(b, "ru"));
  const active = typeof query.subject === "string" ? key(query.subject) : "";
  const visible = active ? teachers.filter(teacher => teacher.subjects.some(subject => key(subject) === active)) : teachers;

  return <div className={styles.publicPage}>
    <PublicHeader signedIn={!!user} />
    <main className={styles.container}>
      <section className={styles.catalogHero}>
        <h1>Найдите своего<br className={styles.heroBreak} /> преподавателя</h1>
        <p>Подготовка к ОГЭ и ЕГЭ, школьные темы и индивидуальные занятия.</p>
      </section>
      <section className={styles.catalog} aria-label="Каталог преподавателей">
        <div className={styles.catalogHeading}>
          <h2>Преподаватели <span>{visible.length}</span></h2>
          <nav className={styles.filters} aria-label="Фильтр по предмету">
            <Link href="/" aria-current={!active ? "page" : undefined}>Все предметы</Link>
            {subjects.map(subject => <Link key={subject} href={{ pathname: "/", query: { subject } }}
              aria-current={active === key(subject) ? "page" : undefined}>{subject}</Link>)}
          </nav>
        </div>
        {visible.length ? <div className={styles.grid}>
          {visible.map(teacher => <article className={styles.card} key={teacher.id}>
            <TeacherIdentity name={teacher.name} subject={teacher.subjects[0]} />
            <h3><Link href={teacherPath(teacher.id)}>{teacher.name}</Link></h3>
            <TeacherSubjects subjects={teacher.subjects} />
            <p className={styles.summary}>{teacher.description}</p>
            <div className={styles.cardFooter}>
              <HourlyRate rate={teacher.hourly_rate} />
              <Link className={styles.outline} href={teacherPath(teacher.id)}>Визитка <span aria-hidden="true">↗</span></Link>
            </div>
          </article>)}
        </div> : <div className={styles.empty}>
          <p>{active ? "По этому предмету пока нет преподавателей." : "Преподаватели появятся здесь после публикации визиток."}</p>
          {active && <Link href="/">Показать всех</Link>}
        </div>}
      </section>
    </main>
  </div>;
}
