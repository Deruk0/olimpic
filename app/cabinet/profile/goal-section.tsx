import Link from "next/link";
import { first } from "../../../lib/db";
import {
  editProfileGoalPath, emptyStudentGoal, goalAdmissionPlans, goalCompetitions, goalDirections, goalKinds,
  goalOptionLabel, goalResultText, type StudentGoal,
} from "../../../lib/student-goal";
import { InterfaceIcon } from "../../interface-icons";
import { GoalForm } from "./goal-form";

export async function GoalSection({ student, mode }: { student: string; mode?: string }) {
  const editing = mode === "edit";
  const saved = await first<{ details: StudentGoal; image_version: string | null }>(
    "SELECT details,image_version FROM student_goal_profiles WHERE student=$1", [student]
  );
  const image = saved?.image_version ? "/cabinet/profile/goal-image?v=" + saved.image_version : "";
  const visual = <figure className="goal-visual">
    <figcaption>Визуализация цели</figcaption>
    <div className="goal-image">
      {image ? <img src={image} alt="Изображение цели" /> : <InterfaceIcon name="image" />}
    </div>
  </figure>;

  return <section className="panel profile-goal" id="my-goal" aria-labelledby="my-goal-title">
    <div className="split">
      <h2 id="my-goal-title">Моя цель</h2>
      {!editing && <Link className="button secondary" href={editProfileGoalPath}>
        {saved ? "Редактировать" : "Заполнить цель"}
      </Link>}
    </div>
    {mode === "saved" && saved && <p className="notice" role="status">Цель сохранена.</p>}
    {editing ? <GoalForm goal={saved?.details ?? emptyStudentGoal} image={image} />
      : saved ? <div className="goal-layout goal-overview">
        <GoalOverview goal={saved.details} />
        {visual}
      </div>
      : <p className="muted goal-empty">Расскажите, чего хотите достичь на олимпиаде и какие направления вас интересуют.</p>}
  </section>;
}

function GoalOverview({ goal }: { goal: StudentGoal }) {
  const directions = goal.directions.map(key => goalOptionLabel(goalDirections, key)).filter(Boolean).join(", ");
  const preparation = [
    ["Целевая олимпиада", goal.competitionName || goalOptionLabel(goalCompetitions, goal.competition)],
    ["Желаемый результат", goalResultText(goal)],
    ["Напоминание себе", goal.reason],
  ].filter(([, value]) => value);
  const admission = [
    ["Целевой вуз", goal.university],
    ["Интересующие направления", directions],
    ["Стратегия поступления", goalOptionLabel(goalAdmissionPlans, goal.admission)],
  ].filter(([, value]) => value);

  return <div className="goal-fields">
    <div>
      <h3>Основная цель</h3>
      <p className="goal-primary">{goalOptionLabel(goalKinds, goal.kind)}</p>
      <GoalFacts facts={preparation} />
    </div>
    {!!admission.length && <div className="goal-admission">
      <h3>Планы на поступление</h3>
      <GoalFacts facts={admission} />
    </div>}
  </div>;
}

function GoalFacts({ facts }: { facts: string[][] }) {
  if (!facts.length) return null;
  return <dl className="profile-facts goal-facts">
    {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
  </dl>;
}
