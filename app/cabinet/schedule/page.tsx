import Link from "next/link";
import { Suspense } from "react";
import { requireAccount } from "../../../lib/auth";
import { studentSchedule } from "../../../lib/student";
import { CabinetFrame } from "../frame";
import { ScheduleBoard } from "./board";
import { TeacherSchedule, type ScheduleQuery } from "./teacher-schedule";
import "./schedule.css";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<ScheduleQuery> }) {
  const [user, query] = await Promise.all([requireAccount(), searchParams]);
  const teacher = user.role === "teacher";
  return <CabinetFrame user={user} view="schedule" title="Расписание" saved={query.saved} error={query.error}
    action={teacher && !query.edit && query.new !== "1" ? <Link className="button" href="/cabinet/schedule?new=1">Назначить урок</Link> : undefined}>
    <Suspense fallback={teacher ? <p className="panel muted" role="status">Загружаем занятия…</p> :
      <div className="schedule-board" role="status">
        <div className="week-toolbar schedule-toolbar-placeholder"><span>Загружаем занятия…</span></div>
        <div className="week-workspace">
          <div className="week-calendar schedule-calendar-placeholder" aria-hidden="true" />
          <div className="week-inspector schedule-inspector-placeholder" aria-hidden="true" />
        </div>
      </div>}>
      {teacher ? <TeacherSchedule teacher={user} query={query} /> : <StudentBoard id={user.id} query={query} />}
    </Suspense>
  </CabinetFrame>;
}

async function StudentBoard({ id, query }: { id: string; query: ScheduleQuery }) {
  const cards = await studentSchedule(id);
  return <ScheduleBoard cards={cards} now={Date.now()} focus={query.focus} week={query.week} day={query.day} archive={query.archive === "1"} />;
}
