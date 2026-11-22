import Link from "next/link";
import styles from "./teachers.module.css";

const rubles = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
const headerLinks = {
  catalog: { href: "/", label: "Преподаватели" },
  cabinet: { href: "/cabinet", label: "Кабинет" },
  login: { href: "/login", label: "Войти" },
};

export function PublicHeader({ destination }: { destination: keyof typeof headerLinks }) {
  const { href, label } = headerLinks[destination];
  return <header className="top">
    <div className="top-inner">
      <Link className="brand-word" href="/" aria-label="Olimpik — каталог преподавателей">Olimpik</Link>
      <Link className="button secondary" href={href}>{label}</Link>
    </div>
  </header>;
}

export function TeacherIdentity({ name }: { name: string }) {
  const words = name.trim().split(/\s+/).slice(0, 2);
  return <span className={"account-avatar " + styles.initials} aria-hidden="true">
    {words.map(word => Array.from(word)[0]).join("").toLocaleUpperCase("ru")}
  </span>;
}

export function TeacherSubjects({ subjects }: { subjects: string[] }) {
  return <ul className={styles.subjects} aria-label="Предметы">{subjects.map(subject => <li key={subject}>{subject}</li>)}</ul>;
}

export function HourlyRate({ rate }: { rate: number }) {
  return <p className={styles.rate}><strong>{rubles.format(rate)}</strong> <span>/ 60 мин</span></p>;
}
