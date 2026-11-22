import { requireAccount } from "../../../lib/auth";
import { studentSchedule } from "../../../lib/student";
import { CabinetFrame } from "../frame";
import { ScheduleBoard } from "./board";
import { TeacherSchedule, type ScheduleQuery } from "./teacher-schedule";
import "./schedule.css";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<ScheduleQuery> }) {
  const user = await requireAccount();
  const query = await searchParams;
  if (user.role === "teacher") return <TeacherSchedule teacher={user} query={query} />;
  const cards = await studentSchedule(user.id);
  return <CabinetFrame user={user} view="schedule" title="Расписание" saved={query.saved} error={query.error}>
    <ScheduleBoard cards={cards} now={Date.now()} focus={query.focus} archive={query.archive === "1"} />
  </CabinetFrame>;
}
