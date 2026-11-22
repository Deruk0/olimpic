import Link from "next/link";
import { requireAccount, type SessionAccount } from "../../../lib/auth";
import { teacherPath } from "../../../lib/booking";
import { first, rows } from "../../../lib/db";
import { roles } from "../../../lib/model";
import { linkedStudents } from "../../../lib/teacher";
import { telegramBotName, telegramConfigured } from "../../../lib/telegram-data";
import { signOut } from "../../actions";
import { Submit } from "../../components";
import { AccountAvatar, CabinetFrame } from "../frame";
import { detachLearningContact, removeProfileAvatar, saveProfile } from "./actions";
import { ThemeSettings } from "./theme-settings";
import { TelegramSettings, type TelegramDelivery } from "./telegram-settings";
import "./profile.css";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [user, { saved, error }] = await Promise.all([requireAccount(), searchParams]);

  return <CabinetFrame user={user} view="profile" title="Личный профиль" saved={saved} error={error}>
    <div className="profile-grid" data-role={user.role}>
      <PersonalDetails user={user} />
      <ThemeSettings />
      <LearningContacts user={user} />
      {user.role === "student" && <StudentTelegram student={user.id} />}
      <AccountSettings user={user} />
    </div>
  </CabinetFrame>;
}

async function StudentTelegram({ student }: { student: string }) {
  const link = await first<{ status: TelegramDelivery | null }>(`SELECT (
    SELECT j.status FROM telegram_jobs j WHERE j.student_id=l.student_id AND j.link_id=l.id AND j.kind='test'
    ORDER BY j.created_at DESC LIMIT 1) AS status FROM telegram_links l WHERE l.student_id=$1`, [student]);
  return <TelegramSettings enabled={telegramConfigured()} linked={!!link}
    botName={telegramBotName()} test={link?.status ?? null} />;
}

function PersonalDetails({ user }: { user: SessionAccount }) {
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
      <Submit>Сохранить изменения</Submit>
    </form>
    {user.avatar_version && <form action={removeProfileAvatar} className="profile-remove-photo">
      <Submit secondary>Удалить фото</Submit>
    </form>}
  </section>;
}

async function LearningContacts({ user }: { user: SessionAccount }) {
  const teacher = user.role === "teacher";
  const contacts: { id: string; name: string; subjects?: string[]; published?: boolean }[] = teacher ? await linkedStudents(user.id) :
    await rows(`SELECT a.id,a.name,CASE WHEN cardinality(p.subjects)>0 THEN p.subjects ELSE ARRAY[p.subject] END AS subjects,
      p.hourly_rate IS NOT NULL AND cardinality(p.subjects)>0 AND p.description<>'' AS published
      FROM teacher_students ts JOIN teacher_profiles p ON p.teacher_id=ts.teacher_id JOIN accounts a ON a.id=p.teacher_id
      WHERE ts.student_id=$1 ORDER BY a.name,a.id`,
      [user.id]);

  return <section className="panel" id="learning-contacts">
    <h2>{teacher ? "Мои ученики" : "Мои преподаватели"}</h2>
    {contacts.length === 0 ? <p className="muted">{teacher ? "У вас пока нет учеников." : "У вас пока нет преподавателей."}</p> :
      contacts.map(contact => <form key={contact.id} action={detachLearningContact.bind(null, contact.id)} className="profile-contact">
        <div>{contact.published ? <Link href={teacherPath(contact.id)}>{contact.name}</Link> : contact.name}
          {!!contact.subjects?.length && <small>{contact.subjects.join(", ")}</small>}</div>
        <button type="submit" className="secondary" aria-label={"Отвязать: " + contact.name}>Отвязать</button>
      </form>)}
  </section>;
}

function AccountSettings({ user }: { user: SessionAccount }) {
  return <section className="panel" id="account-settings">
    <h2>Настройки аккаунта</h2>
    <div className="profile-account-body">
      <dl className="profile-facts">
        <div><dt>Роль</dt><dd>{roles[user.role]}</dd></div>
        <div><dt>Способ входа</dt><dd>{user.demo_session ? "Тестовый доступ" : "Код приглашения"}</dd></div>
      </dl>
      <form action={signOut}><Submit secondary pendingLabel="Выходим…">Выйти из аккаунта</Submit></form>
    </div>
  </section>;
}
