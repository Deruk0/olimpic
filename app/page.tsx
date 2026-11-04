import { redirect } from "next/navigation";
import { account } from "../lib/auth";
import { signIn } from "./actions";
import { Submit } from "./components";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await account()) redirect("/cabinet");
  const { error } = await searchParams;
  return <main className="landing">
    <section className="hero"><div className="brand"><span>O</span> Olimpik</div>
      <p className="eyebrow">Пилот · олимпиадная математика</p>
      <h1>Готовьтесь к олимпиаде по своему плану</h1>
      <p>Диагностика, занятия с куратором и обратная связь по каждому решению.</p>
      <div className="hero-steps"><span>01 Диагностика</span><span>02 Траектория</span><span>03 Практика</span></div>
    </section>
    <section className="login">
      <div className="panel"><p className="eyebrow">Учебная платформа</p><h2>Вход в кабинет</h2>
        <p className="muted">Введите код приглашения. Из файла демо-кодов можно скопировать строку нужной роли целиком.</p>
        {error === "invite" && <p className="notice error" role="alert">Приглашение недействительно, уже использовано или просрочено.</p>}
        <form action={signIn} className="editor">
          <label>Код приглашения<input required name="invite" autoComplete="off" spellCheck={false} /></label>
          <Submit>Войти в Olimpik</Submit>
        </form>
      </div>
    </section>
  </main>;
}
