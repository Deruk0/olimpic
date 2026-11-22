import Image from "next/image";
import { InterfaceIcon } from "./interface-icons";
import { SchoolCarousel } from "./school-carousel";
import styles from "./school-carousel.module.css";

export function SchoolHighlights() {
  return <SchoolCarousel id="about" title="Как учатся в Олимпике" label="Карточки об обучении">
    <li className={`${styles.card} ${styles.curator}`}>
      <div className={styles.copy}>
        <h3>Куратор разбирает решение</h3>
        <p>Покажет, где идея работает и какой шаг стоит обосновать.</p>
      </div>
      <div className={styles.art}>
        <Image className={styles.portrait} src="/brand/olimpik-curator-portrait.webp"
          width={640} height={800} sizes="(max-width: 740px) 180px, 270px" alt="" />
        <figure className={styles.note}>
          <figcaption>Пример комментария</figcaption>
          <p>Проверь, меняется ли чётность числа орлов после любого хода.</p>
        </figure>
      </div>
    </li>

    <li className={`${styles.card} ${styles.practice}`}>
      <div className={styles.copy}>
        <h3>Много практики</h3>
        <p>Разбираем приём на примере и сразу пробуем его в новой задаче.</p>
        <a href="#learning">Посмотреть этапы подготовки <span aria-hidden="true">↓</span></a>
      </div>
      <div className={styles.art} aria-hidden="true">
        <div className={styles.checker} />
        <Image className={styles.portrait} src="/brand/olimpik-practice-portrait.webp"
          width={640} height={800} sizes="(max-width: 740px) 180px, 260px" alt="" />
        <div className={styles.boardLabel}>8 × 8</div>
      </div>
    </li>

    <li className={`${styles.card} ${styles.diagnostic}`}>
      <div className={styles.copy}>
        <h3>Стартуем с диагностики</h3>
        <p>Первые задачи подсказывают, с каких тем лучше начать.</p>
      </div>
      <div className={styles.art}>
        <div className={styles.worksheet}>
          <strong>Пример диагностики</strong>
          <ol><li>Четыре подряд</li><li>Монеты</li><li>Рассадка</li></ol>
        </div>
      </div>
    </li>

    <li className={`${styles.card} ${styles.trajectory}`}>
      <div className={styles.copy}>
        <h3>Свой план подготовки</h3>
        <p>Куратор подбирает уровень и порядок тем под ваш старт.</p>
        <a href="#program">Сравнить уровни <span aria-hidden="true">↓</span></a>
      </div>
      <div className={styles.art}>
        <div className={styles.pathStack}>
          <div><strong>Базовый</strong><span>Остатки и делимость</span></div>
          <div><strong>Продвинутый</strong><span>Раскраски и инварианты</span></div>
        </div>
      </div>
    </li>

    <li className={`${styles.card} ${styles.scoring}`}>
      <div className={styles.copy}>
        <h3>Баллы за ход мысли</h3>
        <p>На диагностике ценятся наблюдения, верная идея и полное доказательство.</p>
      </div>
      <div className={styles.art}>
        <div className={styles.rubricVisual}>
          <div><strong>0–5</strong><span>за задачу</span></div>
          <span>Наблюдение</span>
          <span>Идея</span>
          <span>Доказательство</span>
        </div>
      </div>
    </li>

    <li className={`${styles.card} ${styles.cabinet}`}>
      <div className={styles.copy}>
        <h3>Всё в учебном кабинете</h3>
        <p>Расписание, конспекты и проверка работ всегда под рукой.</p>
        <a href="#platform">Посмотреть кабинет <span aria-hidden="true">↓</span></a>
      </div>
      <div className={styles.art} aria-hidden="true">
        <div className={styles.window}>
          <div><InterfaceIcon name="schedule" />Расписание</div>
          <div><InterfaceIcon name="programs" />Конспекты</div>
          <div><InterfaceIcon name="review" />Проверка работ</div>
        </div>
      </div>
    </li>
  </SchoolCarousel>;
}
