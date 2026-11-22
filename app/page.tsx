import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { siteUrl } from "../lib/site-url";
import { canAcceptInquiries } from "../lib/inquiry-access";
import { BrandLogo } from "./brand-logo";
import { InterfaceIcon } from "./interface-icons";
import { SchoolHighlights } from "./school-highlights";
import { SchoolConsultation, SchoolJourney } from "./school-journey";
import styles from "./school.module.css";

const title = "Олимпик — онлайн-школа олимпиадной математики";
const description = "Олимпик (Olimpik) — онлайн-школа для учеников 8–9 классов. Готовим к олимпиадам по математике: диагностика, персональный учебный план, практика и разбор решений с куратором.";

export const metadata: Metadata = {
  title,
  description,
  alternates: siteUrl ? { canonical: "/" } : undefined,
  openGraph: {
    title,
    description,
    siteName: "Олимпик",
    locale: "ru_RU",
    type: "website",
    url: siteUrl ? "/" : undefined,
  },
};

const tracks = [
  {
    style: styles.basic,
    icon: "programs",
    title: "Базовый уровень",
    audience: "Если только начинаете",
    description: "Знакомимся с олимпиадными приёмами и пишем первые доказательства.",
    topics: [
      ["Делимость и остатки", "n = 3q + r"],
      ["Чётность", "2k + 1"],
      ["Комбинаторика", "3 × 2 × 1"],
    ],
  },
  {
    style: styles.advanced,
    icon: "plan",
    title: "Продвинутый уровень",
    audience: "Если уже решали олимпиады",
    description: "Учимся выбирать приём и соединять несколько идей в одном доказательстве.",
    topics: [
      ["Взаимно простые модули", "gcd(3,5)=1"],
      ["Раскраски и инварианты", "−1, +1"],
      ["Подсчёт пересечений", "A ∩ B"],
    ],
  },
] as const;

const questions = [
  ["Подойдёт ли школа, если я никогда не участвовал в олимпиаде?", "Да, у программы есть базовый уровень. На диагностике куратор смотрит, какие приёмы уже знакомы, и предлагает темы для старта."],
  ["Что нужно сделать на диагностике?", "Решить несколько задач и приложить фото или PDF с обоснованием. Куратор оценивает ход решения и учитывает результаты при составлении плана."],
  ["Как устроены занятия и домашние задания?", "Расписание и материалы появляются в кабинете. Ученик может вернуться к теории, открыть работу и загрузить решение. Комментарии куратора видны рядом с проверенной работой."],
  ["За что ставят баллы на диагностике?", "За каждую задачу можно получить до 5 баллов. Полезные наблюдения дают 1–2 балла, верная идея с пробелом в доказательстве — 3–4, полное доказательство — 5."],
  ["Как понять, есть ли прогресс?", "В кабинете можно смотреть результаты работ по темам. Баллы и комментарии помогают увидеть, какие приёмы уже получаются, а где ещё нужно потренироваться."],
  ["Как попасть в личный кабинет?", "Откройте страницу «Войти в кабинет» и введите код приглашения, который вы получили от школы."],
];

export default function Home() {
  const canApply = canAcceptInquiries();
  return <div className={styles.school}>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.brand} aria-label="Олимпик — главная"><BrandLogo /></Link>
        <nav className={styles.nav} aria-label="О школе">
          <a href="#about">О школе</a>
          <a href="#program">Программа</a>
          <a href="#platform">Платформа</a>
          <a href="#faq">Вопросы</a>
        </nav>
        <Link href="/login" className={styles.login} prefetch={false}>Войти в кабинет <span aria-hidden="true">→</span></Link>
      </div>
    </header>

    <main className={styles.container}>
      <section className={styles.hero} aria-labelledby="school-title">
        <div className={styles.heroCopy}>
          <p className={styles.audience}>Онлайн-школа для 8–9 классов</p>
          <h1 id="school-title">Олимпиадная <span>математика</span></h1>
          <p className={styles.lead}>Решаем задачи за рамками учебника и готовимся к олимпиадам вместе с куратором.</p>
          <div className={styles.heroActions}>
            <a className={styles.primary} href={canApply ? "#consultation" : "#program"}>{canApply ? "Оставить заявку" : "Посмотреть программу"} <span aria-hidden="true">↓</span></a>
            <a className={styles.heroLink} href={canApply ? "#program" : "#learning"}>{canApply ? "Посмотреть программу" : "Как проходит подготовка"} <span aria-hidden="true">↓</span></a>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <Image className={styles.heroImage} src="/brand/olimpik-hero-portrait.webp" width={1280} height={960}
            sizes="(max-width: 760px) 94vw, (max-width: 1440px) 53vw, 740px"
            loading="eager" fetchPriority="high" alt="" />
        </div>
      </section>

      <SchoolHighlights />

      <section className={styles.program} id="program" aria-labelledby="program-title">
        <div className={styles.sectionTitle}>
          <p className={styles.kicker}>Программа</p>
          <h2 id="program-title">Два уровня подготовки</h2>
        </div>
        <div className={styles.levels}>
          {tracks.map(track => <article className={track.style} key={track.title}>
            <div className={styles.levelHeader}>
              <p className={styles.levelAudience}>{track.audience}</p>
              <InterfaceIcon name={track.icon} />
            </div>
            <h3>{track.title}</h3>
            <p>{track.description}</p>
            <ul className={styles.topics} role="list">
              {track.topics.map(([topic, example]) => <li key={topic}>
                <span className={styles.topicExample}>{example}</span>
                <span className={styles.topicName}>{topic}</span>
              </li>)}
            </ul>
          </article>)}
        </div>
        <div className={styles.programHelp}>
          <p>Подходящий уровень подскажем после диагностики.</p>
          {canApply && <a href="#consultation">Обсудить подготовку <span aria-hidden="true">→</span></a>}
        </div>
      </section>

      <section className={styles.platform} id="platform" aria-labelledby="platform-title">
        <div className={styles.platformCopy}>
          <p className={styles.kicker}>Платформа «Олимпика»</p>
          <h2 id="platform-title">Учёба в одном кабинете</h2>
          <ul role="list">
            <li><InterfaceIcon name="schedule" /><span><strong>Расписание</strong>Дата следующего занятия и конспекты.</span></li>
            <li><InterfaceIcon name="homework" /><span><strong>Учебные работы</strong>Задачи, отправка решений и комментарии.</span></li>
            <li><InterfaceIcon name="plan" /><span><strong>Траектория</strong>Темы, которые уже разобрали и которые предстоит изучить.</span></li>
          </ul>
        </div>
        <figure className={styles.platformPreview}>
          <figcaption>
            <span>Пример урока</span>
            <a href="/brand/olimpik-lesson-preview.webp" target="_blank" rel="noreferrer">Открыть крупнее <span aria-hidden="true">↗</span></a>
          </figcaption>
          <div className={styles.platformScreen}>
            <Image src="/brand/olimpik-lesson-preview.webp" width={1280} height={590}
              sizes="(max-width: 760px) 90vw, 52vw" alt="Кабинет ученика с открытым занятием «Остатки и делимость»" />
          </div>
        </figure>
      </section>

      <SchoolJourney />
      <SchoolConsultation />

      <section className={styles.faq} id="faq" aria-labelledby="faq-title">
        <div>
          <p className={styles.kicker}>Для учеников и родителей</p>
          <h2 id="faq-title">Частые вопросы</h2>
        </div>
        <div className={styles.questions}>
          {questions.map(([question, answer]) => <details name="school-faq" key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>)}
        </div>
      </section>
    </main>

    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <Link href="/" className={styles.brand} aria-label="Олимпик — главная"><BrandLogo /></Link>
        <p>Онлайн-школа олимпиадной математики</p>
        <Link href="/login" className={styles.login} prefetch={false}>Войти в кабинет <span aria-hidden="true">→</span></Link>
      </div>
    </footer>
  </div>;
}
