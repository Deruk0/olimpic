import Link from "next/link";
import { BrandLogo } from "./brand-logo";
import styles from "./teachers.module.css";

const rubles = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });

export function PublicHeader({ signedIn }: { signedIn: boolean }) {
  return <header className={styles.header}>
    <div className={styles.container}>
      <Link className={styles.brand} href="/" aria-label="Olimpik — каталог"><BrandLogo /></Link>
      <Link className={styles.headerLink} href={signedIn ? "/cabinet" : "/login"}>{signedIn ? "Кабинет" : "Войти"}</Link>
    </div>
  </header>;
}

export function TeacherIdentity({ name, subject }: { name: string; subject: string }) {
  const words = name.trim().split(/\s+/).slice(0, 2);
  const tone = subject.toLocaleLowerCase("ru");
  return <span className={styles.initials} data-tone={tone.includes("русск") ? "peach" : tone.includes("информат") ? "mint" : "lilac"} aria-hidden="true">
    {words.map(word => Array.from(word)[0]).join("").toLocaleUpperCase("ru")}
  </span>;
}

export function TeacherSubjects({ subjects }: { subjects: string[] }) {
  return <ul className={styles.subjects} aria-label="Предметы">{subjects.map(subject => <li key={subject}>{subject}</li>)}</ul>;
}

export function HourlyRate({ rate }: { rate: number }) {
  return <p className={styles.rate}><strong>{rubles.format(rate)}</strong> <span>/ 60 мин</span></p>;
}
