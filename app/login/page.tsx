import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { account } from "../../lib/auth";
import { loginDestination } from "../../lib/booking";
import { signIn } from "../actions";
import { BrandLogo } from "../brand-logo";
import { Submit } from "../components";
import { DemoRoles } from "../demo-roles";

export const metadata: Metadata = {
  title: "Вход в личный кабинет — Олимпик",
  robots: { index: false, follow: true },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; teacher?: string }> }) {
  const { error, teacher } = await searchParams;
  if (await account()) redirect(loginDestination(teacher));

  return <main className="landing">
    <section className="hero">
      <Link href="/" className="brand" aria-label="Олимпик — главная"><BrandLogo variant="wordmark" /></Link>
      <p className="eyebrow">Уроки с преподавателем</p>
      <h1>Вход в кабинет</h1>
      <p>Расписание, учебные материалы и обратная связь по вашим решениям.</p>
      <Link href="/">← На главную</Link>
      <div className="hero-geometry" aria-hidden="true" />
    </section>
    <section className="login" aria-labelledby="login-title">
      <div className="panel">
        <h2 id="login-title">Вход по приглашению</h2>
        <p className="muted">Введите код приглашения.</p>
        {error === "demo" && <p className="notice error" role="alert">Демо-аккаунт пока недоступен.</p>}
        {error === "invite" && <p className="notice error" role="alert">Приглашение недействительно, уже использовано или просрочено.</p>}
        <form action={signIn} className="editor">
          {teacher && <input type="hidden" name="teacher" value={teacher} />}
          <label>Код приглашения<input required name="invite" autoComplete="off" spellCheck={false} /></label>
          <Submit pendingLabel="Входим…">Войти в Olimpik</Submit>
        </form>
        <DemoRoles teacher={teacher} />
      </div>
    </section>
  </main>;
}
