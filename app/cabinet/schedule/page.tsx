import { mutate } from "../../actions";
import { requireAccount } from "../../../lib/auth";
import { preparationGoal, studentSchedule } from "../../../lib/student";
import { Submit } from "../../submit";
import { CabinetFrame } from "../frame";
import { ScheduleBoard } from "./board";
import "./schedule.css";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; focus?: string; archive?: string }> }) {
  const user = await requireAccount("student");
  const query = await searchParams;
  const [{ group, cards }, goal] = await Promise.all([studentSchedule(user.id), user.goal ? "" : preparationGoal()]);
  return <CabinetFrame user={user} view="schedule" title="Расписание" saved={query.saved} error={query.error}>
    <p className="schedule-lead">{group || "Вас пока не добавили в группу."}{user.goal ? " · " + user.goal : ""}</p>
    {!user.goal && goal && <section className="panel schedule-goal" id="goal">
      <h2>Целевая олимпиада</h2>
      <p className="muted">Цель нужна один раз: после неё открывается сдача работ.</p>
      <form action={mutate} className="editor schedule-goal-form">
        <input type="hidden" name="action" value="goal" />
        <input type="hidden" name="return" value="learn" />
        <label>К чему вы готовитесь?<select name="goal"><option>{goal}</option></select></label>
        <Submit>Подтвердить цель</Submit>
      </form>
    </section>}
    <ScheduleBoard cards={cards} now={Date.now()} focus={query.focus} archive={query.archive === "1"} />
  </CabinetFrame>;
}
