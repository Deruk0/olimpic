import { InterfaceIcon, type InterfaceIconName } from "./interface-icons";
import { InquiryForm } from "./inquiry-form";
import { SchoolCarousel } from "./school-carousel";
import { canAcceptInquiries, inquiryPolicyUrl } from "../lib/inquiry-access";
import type { ReactNode } from "react";
import styles from "./school-journey.module.css";

const steps: { title: string; detail: string; icon: InterfaceIconName; preview: string; example: ReactNode }[] = [
  {
    title: "Начинаете с диагностики", detail: "Решаете несколько задач, чтобы найти подходящую точку старта.", icon: "search",
    preview: "Входная диагностика",
    example: <div className={styles.miniTasks}><span>Четыре подряд</span><span>Монеты</span><span>Рассадка</span></div>,
  },
  {
    title: "Получаете свой план", detail: "Куратор подбирает уровень и порядок тем.", icon: "plan",
    preview: "Траектория",
    example: <div className={styles.miniRoute}><span>Остатки</span><span>Чётность</span><span>Подсчёт</span></div>,
  },
  {
    title: "Разбираете новый приём", detail: "Смотрите, как работает идея, на конкретной задаче.", icon: "programs",
    preview: "Конспект занятия",
    example: <div className={styles.miniFormula}><strong>n = 3q + r</strong><span>Остаток r — 0, 1 или 2</span></div>,
  },
  {
    title: "Закрепляете практикой", detail: "Решаете похожую задачу и отправляете своё доказательство.", icon: "homework",
    preview: "Задача о домино",
    example: <div className={styles.miniPuzzle}><span /><strong>8 × 8</strong></div>,
  },
  {
    title: "Разбираете решение", detail: "Куратор показывает, какой шаг стоит обосновать подробнее.", icon: "review",
    preview: "Комментарий куратора",
    example: <div className={styles.miniComment}>Хорошая идея. Обоснуйте последний шаг.</div>,
  },
  {
    title: "Видите прогресс", detail: "В кабинете видно, какие темы уже пройдены и что дальше.", icon: "course",
    preview: "Темы и результаты",
    example: <div className={styles.miniBars}><span /><span /><span /><span /><span /></div>,
  },
];

export function SchoolJourney() {
  return <SchoolCarousel id="learning" title="Как проходит подготовка" label="Этапы подготовки"
    description="Шесть шагов подготовки с куратором.">
    {steps.map((step, index) => <li className={styles.step} key={step.title}>
      <div className={styles.stepCopy}>
        <span className={styles.stepNumber}>Шаг {index + 1}</span>
        <h3>{step.title}</h3>
        <p>{step.detail}</p>
      </div>
      <div className={styles.preview} aria-hidden="true">
        <div className={styles.previewTitle}><InterfaceIcon name={step.icon} /><strong>{step.preview}</strong></div>
        {step.example}
      </div>
    </li>)}
  </SchoolCarousel>;
}

export function SchoolConsultation() {
  const canApply = canAcceptInquiries();

  return <section className={styles.consultation} id="consultation" aria-labelledby="consultation-title">
    <div className={styles.consultationCopy}>
      <h2 id="consultation-title">Поможем начать подготовку</h2>
      <p>{canApply ? "Оставьте контакт. Позвоним или напишем, чтобы обсудить подготовку к олимпиадам." :
        "Подскажем, с какого уровня начать и как устроены занятия."}</p>
      <ul role="list">
        <li><InterfaceIcon name="review" />Объясним, как проходит диагностика</li>
        <li><InterfaceIcon name="review" />Поможем выбрать уровень</li>
        <li><InterfaceIcon name="review" />Ответим на вопросы о занятиях</li>
      </ul>
    </div>
    {canApply ? <InquiryForm policyUrl={inquiryPolicyUrl()} /> : <div className={styles.form}>
      <h3>Приём заявок пока закрыт</h3>
      <p>Познакомиться с темами и уровнями можно в разделе «Программа».</p>
      <a href="#program">Посмотреть программу <span aria-hidden="true">↑</span></a>
    </div>}
  </section>;
}
