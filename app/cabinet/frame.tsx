import Link from "next/link";
import { roles, type Account } from "../../lib/model";
import type { SessionAccount } from "../../lib/auth";
import { signOut } from "../actions";
import { InterfaceIcon, type InterfaceIconName } from "../interface-icons";
import { ScrollArea } from "../scroll-area";
import { CabinetShell } from "./shell";
import { CabinetFeedback } from "./feedback";
import "./cabinet.css";

export const cabinetNav = {
  teacher: [["schedule", "Расписание"], ["students", "Ученики"], ["library", "Библиотека"], ["review", "Проверка работ"], ["visit-card", "Моя визитка"], ["bookings", "Заявки на занятия"]],
  student: [["schedule", "Расписание"], ["homework", "Домашние задания"], ["course", "Статистика"], ["bookings", "Мои заявки"], ["catalog", "Преподаватели"]]
} as const;

function sectionIcon(id: typeof cabinetNav[Account["role"]][number][0]): InterfaceIconName {
  if (id === "students") return "groups";
  if (id === "visit-card") return "plan";
  if (id === "bookings") return "review";
  return id === "catalog" ? "search" : id;
}

export function AccountAvatar({ user, large = false }: { user: SessionAccount; large?: boolean }) {
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]).join("").toLocaleUpperCase("ru");
  return <span className={"account-avatar" + (large ? " account-avatar-large" : "")} aria-hidden="true">
    {user.avatar_version ? <img src={"/cabinet/profile/avatar?v=" + user.avatar_version} alt="" /> : initials}
  </span>;
}

export function CabinetFrame({ user, view, title, action, back, saved, error, children }: {
  user: SessionAccount; view: string; title: string; action?: React.ReactNode;
  back?: { href: string; label: string }; saved?: string; error?: string; children: React.ReactNode;
}) {
  const student = user.role === "student";
  const navigation = cabinetNav[user.role];
  const brand = <Link className="brand-word" aria-label="Olimpik — главная кабинета" href={student ? "/cabinet/schedule" : "/cabinet"}>Olimpik</Link>;
  const profile = <div className="account cabinet-account">
    <Link className="account-profile" href="/cabinet/profile" aria-label={"Профиль · " + user.name} aria-current={view === "profile" ? "page" : undefined}>
      <AccountAvatar user={user} />
      <span className="account-name"><span>{user.name}</span><small>{roles[user.role]}</small></span>
    </Link>
    <form action={signOut}><button className="secondary account-exit" aria-label="Выйти" title="Выйти"><InterfaceIcon name="logout" /></button></form>
  </div>;
  return <CabinetShell preferences={{ mode: user.theme, palette: user.theme_palette }}>
    <a className="skip-link" href="#cabinet-content">К содержимому</a>
    <div className={"cabinet-workspace" + (back ? " cabinet-focus" : "")}>
      {back ? <header className="cabinet-focus-bar">
        {brand}
        <Link href={back.href}>← {back.label}</Link>
      </header> : <aside className="cabinet-sidebar">
        {brand}
        <ScrollArea label="Разделы кабинета" role="navigation" className="cabinet-navigation" viewportClassName="cabinet-nav" contentClassName="cabinet-nav-items">{navigation.map(([id, label]) =>
          <Link key={id} className={view === id ? "active" : ""} aria-current={view === id ? "page" : undefined} href={id === "catalog" ? "/" : "/cabinet/" + id}>
            <InterfaceIcon name={sectionIcon(id)} /><span>{label}</span>
          </Link>
        )}</ScrollArea>
        {profile}
      </aside>}
      <main className="cabinet-content" id="cabinet-content" tabIndex={-1}>
        <div className="page-heading"><h1>{title}</h1>{action}</div>
        {(saved || error) && <CabinetFeedback key={error ?? saved} error={error} />}
        {children}
      </main>
      {back && profile}
    </div>
  </CabinetShell>;
}
