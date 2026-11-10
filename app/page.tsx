import { redirect } from "next/navigation";
import { account } from "../lib/auth";
import { signIn } from "./actions";
import { Submit } from "./components";
import { BrandLogo } from "./brand-logo";
import { DemoRoles } from "./demo-roles";
import { demoLoginEnabled } from "../lib/demo-access";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await account()) redirect("/cabinet");
  const { error } = await searchParams;
  return <main className="landing">
    <section className="hero"><div className="brand"><BrandLogo variant="wordmark" /></div>
      <p className="eyebrow">Олимпиадная математика · 8–9 классы</p>
      <h1>Готовьтесь к олимпиаде по своему плану</h1>
      <p>Диагностика, занятия с куратором и обратная связь по каждому решению.</p>
      <div className="hero-steps"><span>01 Диагностика</span><span>02 Траектория</span><span>03 Практика</span></div>
      <div className="hero-geometry" aria-hidden="true" />
    </section>
    <section className="login">
      <div className="panel"><div className="login-brand"><BrandLogo variant="stacked" /></div><p className="eyebrow">Учебная платформа</p><h2>Вход в кабинет</h2>
        <DemoRoles />
        <p className="muted">{demoLoginEnabled() ? "Или войдите по приглашению." : "Введите код приглашения, чтобы открыть свой кабинет."}</p>
        {error === "demo" && <p className="notice error" role="alert">Демо-аккаунт пока недоступен.</p>}
        {error === "invite" && <p className="notice error" role="alert">Приглашение недействительно, уже использовано или просрочено.</p>}
        <form action={signIn} className="editor">
          <label>Код приглашения<input required name="invite" autoComplete="off" spellCheck={false} /></label>
          <Submit>Войти в Olimpik</Submit>
        </form>
      </div>
    </section>
  </main>;
}
