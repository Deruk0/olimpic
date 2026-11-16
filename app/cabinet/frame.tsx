import Link from "next/link";
import { roles, type Account } from "../../lib/model";
import type { SessionAccount } from "../../lib/auth";
import { signOut } from "../actions";
import { InterfaceIcon, type InterfaceIconName } from "../interface-icons";
import { BrandLogo } from "../brand-logo";
import { CabinetShell } from "./shell";

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

export function AccountAvatar({ user, large = false }: { user: SessionAccount; large?: boolean }) {
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]).join("").toLocaleUpperCase("ru");
  return <span className={"account-avatar" + (large ? " account-avatar-large" : "")} aria-hidden="true">
    {user.avatar_version ? <img src={"/cabinet/profile/avatar?v=" + user.avatar_version} alt="" /> : initials}
  </span>;
}

export function CabinetFrame({ user, view, title, saved, error, children }: {
  user: SessionAccount; view: string; title: string; saved?: string; error?: string; children: React.ReactNode;
}) {
  const student = user.role === "student";
  const identity = <><AccountAvatar user={user} /><span className="account-name">{user.name}<small>{roles[user.role]}</small></span></>;
  return <CabinetShell preferences={{ mode: user.theme, palette: user.theme_palette }}>
    <header className="top">
      <div className="top-inner">
        <div className="top-brand">
          <Link className="brand" aria-label="Olimpik — главная кабинета" href={student ? "/cabinet/schedule" : "/cabinet"}>
            <BrandLogo />
            <BrandLogo variant="wordmark" />
            <BrandLogo variant="mark" />
          </Link>
        </div>
        <div className="account">
          <Link className="account-profile" href="/cabinet/profile" aria-current={view === "profile" ? "page" : undefined}>
            {identity}<InterfaceIcon name="chevronDown" />
          </Link>
          <form action={signOut}><button className="secondary account-exit" aria-label="Выйти"><InterfaceIcon name="logout" /><span>Выйти</span></button></form>
        </div>
      </div>
    </header>
    <div className="workspace">
      <aside className="sidebar">
        <nav aria-label="Разделы кабинета">{cabinetNav[user.role].map(([id, label]) =>
          <Link key={id} className={view === id ? "active" : ""} aria-current={view === id ? "page" : undefined} href={student || id === "library" || id === "planning" || id === "dev" ? "/cabinet/" + id : "/cabinet?view=" + id}>
            <InterfaceIcon name={sectionIcon(id)} /><span>{label}</span>
          </Link>
        )}</nav>
      </aside>
      <main className="content">
        <div className="page-heading"><h1>{title}</h1></div>
        {saved && <p className="notice" role="status">Изменения сохранены.</p>}
        {error && <p className="notice error" role="alert">{error}</p>}
        {children}
      </main>
    </div>
  </CabinetShell>;
}
