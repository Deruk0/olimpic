import Link from "next/link";
import { requireAccount } from "../../../lib/auth";
import { first, rows } from "../../../lib/db";
import type { Account, Group } from "../../../lib/model";
import { CabinetFrame } from "../frame";
import { DevManagement } from "./management";

type Summary = {
  accounts: number; groups: number; lessons: number; deleted: number;
  materials: number; ready: number; submissions: number;
};

export default async function DevPage() {
  const user = await requireAccount("methodist");
  const summary = await first<Summary>(`SELECT
    (SELECT count(*)::int FROM accounts) AS accounts,
    (SELECT count(*)::int FROM groups) AS groups,
    (SELECT count(*)::int FROM assignments WHERE deleted_at IS NULL) AS lessons,
    (SELECT count(*)::int FROM assignments WHERE deleted_at IS NOT NULL) AS deleted,
    (SELECT count(*)::int FROM library_items) AS materials,
    (SELECT count(*)::int FROM library_items WHERE ready) AS ready,
    (SELECT count(*)::int FROM submissions) AS submissions`);
  if (!summary) throw new Error("Не удалось получить сводку.");
  const [accounts, groups] = await Promise.all([
    rows<Pick<Account, "id" | "name" | "role"> & { group_id: string | null }>("SELECT a.id,a.name,a.role,m.group_id FROM accounts a LEFT JOIN members m ON m.student=a.id ORDER BY a.name,a.id"),
    rows<Pick<Group, "id" | "name">>("SELECT id,name FROM groups ORDER BY name,id"),
  ]);
  const metrics = [
    ["Аккаунты", summary.accounts], ["Группы", summary.groups],
    ["Назначенные занятия", summary.lessons], ["Удалённые занятия", summary.deleted],
    ["Материалы библиотеки", summary.materials], ["Сдачи учеников", summary.submissions],
  ] as const;
  return <CabinetFrame user={user} view="dev" title="Dev-панель">
    <p className="muted">Состояние платформы и инструменты для проверки учебных сценариев.</p>
    <section className="panel">
      <div className="split"><h2>Состояние системы</h2><span className="badge badge-success">База данных доступна</span></div>
      <dl className="dev-status">
        <div><dt>Хранилище</dt><dd>{process.env.DATABASE_URL ? "PostgreSQL" : "PGlite"}</dd></div>
        <div><dt>Режим приложения</dt><dd>{process.env.NODE_ENV === "development" ? "Разработка" : "Рабочая сборка"}</dd></div>
        <div><dt>Готовые материалы</dt><dd>{summary.ready} из {summary.materials}</dd></div>
      </dl>
      <a className="button secondary" href="/cabinet/dev">Обновить сводку</a>
    </section>
    <section className="dev-metrics" aria-label="Сводка данных">
      {metrics.map(([label, count]) => <div className="panel" key={label}><span className="muted">{label}</span><strong>{count}</strong></div>)}
    </section>
    <DevManagement accounts={accounts} groups={groups} />
    <section className="panel">
      <h2>Учебные сценарии</h2>
      <div className="controls">
        <Link className="button secondary" href="/cabinet/library">Библиотека материалов</Link>
        <Link className="button secondary" href="/cabinet/planning">Назначение занятий</Link>
        <Link className="button secondary" href="/cabinet?view=groups">Группы и прогресс</Link>
      </div>
    </section>
  </CabinetFrame>;
}
