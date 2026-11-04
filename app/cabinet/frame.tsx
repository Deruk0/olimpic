import Link from "next/link";
import { roles, type Account } from "../../lib/model";
import { signOut } from "../actions";

export const cabinetNav = {
  methodist: [["groups", "Группы и прогресс"], ["planning", "Расписание групп"], ["library", "Библиотека"], ["programs", "Программы и диагностика"]],
  curator: [["schedule", "Расписание"], ["review", "Проверка работ"], ["students", "Траектории"]],
  student: [["learn", "Расписание группы"], ["homework", "Учебные работы"], ["plan", "Моя траектория"], ["course", "Прогресс курса"]]
};

export function CabinetFrame({ user, view, title, saved, error, children }: {
  user: Account; view: string; title: string; saved?: string; error?: string; children: React.ReactNode;
}) {
  return <div className="shell">
    <header className="top"><Link className="brand" href="/cabinet"><span>O</span> Olimpik</Link><div className="account"><span>{user.name}<small>{roles[user.role]}</small></span><form action={signOut}><button className="secondary">Выйти</button></form></div></header>
    <div className="workspace">
      <aside><p className="eyebrow">Кабинет · {roles[user.role]}</p><nav>{cabinetNav[user.role].map(([id, label]) =>
        <Link key={id} className={view === id ? "active" : ""} aria-current={view === id ? "page" : undefined} href={["homework", "course", "library", "planning"].includes(id) ? "/cabinet/" + id : "/cabinet?view=" + id}>{label}</Link>
      )}</nav><div className="side-note">Олимпиадная математика<br /><small>Учебный пилот</small></div></aside>
      <main className="content">
        <p className="eyebrow">Olimpik / {roles[user.role]}</p><h1>{title}</h1>
        {saved && <p className="notice" role="status">Изменения сохранены.</p>}
        {error && <p className="notice error" role="alert">{error}</p>}
        {children}
      </main>
    </div>
  </div>;
}
