import Link from "next/link";
import { roles, type Account } from "../../lib/model";
import { signOut } from "../actions";
import { InterfaceIcon, type InterfaceIconName } from "../interface-icons";
import { BrandLogo } from "../brand-logo";

export const cabinetNav = {
  methodist: [["groups", "Группы и прогресс"], ["planning", "Расписание групп"], ["library", "Библиотека"], ["programs", "Программы и диагностика"], ["dev", "Dev-панель"]],
  curator: [["schedule", "Расписание"], ["review", "Проверка работ"], ["students", "Траектории"]],
  student: [["schedule", "Расписание"], ["homework", "Работы"], ["plan", "Траектория"], ["course", "Статистика"]]
} as const;

const navIcons = { planning: "schedule", students: "plan" } as const;

function sectionIcon(id: typeof cabinetNav[Account["role"]][number][0]): InterfaceIconName {
  if (id === "planning" || id === "students") return navIcons[id];
  return id;
}

export function CabinetFrame({ user, view, title, saved, error, children }: {
  user: Account; view: string; title: string; saved?: string; error?: string; children: React.ReactNode;
}) {
  const student = user.role === "student";
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]).join("").toLocaleUpperCase("ru");
  return <div className="shell">
    <header className="top">
      <div className="top-inner">
        <Link className="brand" aria-label="Olimpik — главная кабинета" href={student ? "/cabinet/schedule" : "/cabinet"}><BrandLogo /></Link>
        <div className="account">
          <span className="account-avatar" aria-hidden="true">{initials}</span>
          <div className="account-name">{user.name}<small>{roles[user.role]}</small></div>
          <form action={signOut}><button className="secondary account-exit" aria-label="Выйти"><InterfaceIcon name="logout" /><span>Выйти</span></button></form>
        </div>
      </div>
    </header>
    <div className="workspace">
      <aside className="sidebar">
        <p className="eyebrow">Навигация</p>
        <nav aria-label="Разделы кабинета">{cabinetNav[user.role].map(([id, label]) =>
          <Link key={id} className={view === id ? "active" : ""} aria-current={view === id ? "page" : undefined} href={student || id === "library" || id === "planning" || id === "dev" ? "/cabinet/" + id : "/cabinet?view=" + id}>
            <InterfaceIcon name={sectionIcon(id)} /><span>{label}</span>
          </Link>
        )}</nav>
        <div className="side-note"><small>8–9 классы</small><strong>Олимпиадная математика</strong></div>
      </aside>
      <main className="content">
        <div className="page-heading"><p className="eyebrow">Кабинет · {roles[user.role]}</p><h1>{title}</h1></div>
        {saved && <p className="notice" role="status">Изменения сохранены.</p>}
        {error && <p className="notice error" role="alert">{error}</p>}
        {children}
      </main>
    </div>
  </div>;
}
