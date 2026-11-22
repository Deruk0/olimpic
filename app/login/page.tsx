import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { account } from "../../lib/auth";
import { loginDestination } from "../../lib/booking";
import { signIn } from "../actions";
import { Submit } from "../components";
import { DemoRoles } from "../demo-roles";
import { PublicHeader } from "../teacher-public";

export const metadata: Metadata = {
  title: "Вход в личный кабинет — Олимпик",
  robots: { index: false, follow: true },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; teacher?: string }> }) {
  const { error, teacher } = await searchParams;
  if (await account()) redirect(loginDestination(teacher));

  return <>
    <PublicHeader destination="catalog" />
    <main className="site-container login-layout">
      <div className="login-intro">
        <h1>Вход в кабинет</h1>
        <p>Расписание, учебные материалы и результаты работ.</p>
      </div>
      <section className="panel login-panel" aria-labelledby="login-title">
        <h2 id="login-title">Вход по приглашению</h2>
        {error === "demo" && <p className="notice error" role="alert">Демо-аккаунт пока недоступен.</p>}
        {error === "invite" && <p className="notice error" role="alert">Приглашение недействительно, уже использовано или просрочено.</p>}
        <form action={signIn} className="editor">
          {teacher && <input type="hidden" name="teacher" value={teacher} />}
          <label>Код приглашения<input required name="invite" autoComplete="off" spellCheck={false} /></label>
          <Submit pendingLabel="Входим…">Войти</Submit>
        </form>
        <DemoRoles teacher={teacher} />
      </section>
    </main>
  </>;
}
