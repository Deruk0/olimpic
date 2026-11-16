import { requireAccount, type SessionAccount } from "../../../lib/auth";
import { first } from "../../../lib/db";
import { roles } from "../../../lib/model";
import { preparationGoal } from "../../../lib/student";
import { signOut } from "../../actions";
import { Submit } from "../../components";
import { AccountAvatar, CabinetFrame } from "../frame";
import { removeProfileAvatar, saveProfile } from "./actions";
import { GoalSection } from "./goal-section";
import { ThemeSettings } from "./theme-settings";
import "./profile.css";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; goal?: string }> }) {
  const [user, { saved, error, goal }] = await Promise.all([requireAccount(), searchParams]);
  const student = user.role === "student";

  return <CabinetFrame user={user} view="profile" title="Личный профиль" saved={saved} error={error}>
    {student && <GoalSection student={user.id} mode={goal} />}
    <div className="profile-grid">
      <div className="profile-column">
        <PersonalDetails user={user} />
        {student && <StudentEnrollment studentId={user.id} />}
      </div>
      <div className="profile-column">
        <ThemeSettings />
        <AccountSettings user={user} />
      </div>
    </div>
  </CabinetFrame>;
}

async function PersonalDetails({ user }: { user: SessionAccount }) {
  const availableGoal = user.role === "student" ? await preparationGoal() : "";
  const goals = user.role === "student" ? [...new Set([user.goal, availableGoal].filter(Boolean))] : [];

  return <section className="panel" id="personal">
    <h2>Личные данные</h2>
    <form action={saveProfile} className="editor">
      <label>Имя и фамилия<input name="name" autoComplete="name" required maxLength={120} defaultValue={user.name} /></label>
      <div className="profile-photo">
        <AccountAvatar user={user} large />
        <label>Фото профиля<input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" />
          <small>JPEG, PNG или WebP до 2 МБ</small>
        </label>
      </div>
      {!!goals.length && <label>Олимпиада учебной программы<select name="goal" defaultValue={user.goal}>
        {!user.goal && <option value="">Выберите олимпиаду</option>}
        {goals.map(goal => <option key={goal} value={goal}>{goal}</option>)}
      </select></label>}
      <Submit>Сохранить изменения</Submit>
    </form>
    {user.avatar_version && <form action={removeProfileAvatar} className="profile-remove-photo">
      <Submit secondary>Удалить фото</Submit>
    </form>}
  </section>;
}

async function StudentEnrollment({ studentId }: { studentId: string }) {
  const enrollment = await first<{ group_name: string; curator_name: string }>(
    "SELECT g.name AS group_name,c.name AS curator_name FROM members m JOIN groups g ON g.id=m.group_id JOIN accounts c ON c.id=g.curator WHERE m.student=$1",
    [studentId]
  );

  return <section className="panel">
    <h2>Обучение</h2>
    <dl className="profile-facts">
      <div><dt>Группа</dt><dd>{enrollment?.group_name ?? "Пока не назначена"}</dd></div>
      {enrollment && <div><dt>Куратор</dt><dd>{enrollment.curator_name}</dd></div>}
    </dl>
  </section>;
}

function AccountSettings({ user }: { user: SessionAccount }) {
  return <section className="panel" id="account-settings">
    <h2>Настройки аккаунта</h2>
    <dl className="profile-facts">
      <div><dt>Роль</dt><dd>{roles[user.role]}</dd></div>
      <div><dt>Способ входа</dt><dd>{user.demo_session ? "Тестовый доступ" : "Код приглашения"}</dd></div>
    </dl>
    <form action={signOut}><Submit secondary pendingLabel="Выходим…">Выйти из аккаунта</Submit></form>
  </section>;
}
