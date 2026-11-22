"use client";

import { Children, cloneElement, isValidElement, useId, useLayoutEffect, useRef, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";
import styles from "./school-carousel.module.css";

type SlideProps = Pick<ComponentProps<"li">, "inert" | "aria-hidden">;

function nearestSlide(list: HTMLUListElement) {
  const first = list.children.item(0) as HTMLElement;
  const second = list.children.item(1) as HTMLElement;
  const step = second.offsetLeft - first.offsetLeft;
  const index = Math.round((list.scrollLeft + (list.clientWidth - first.offsetWidth) / 2 - first.offsetLeft) / step);
  return Math.max(0, Math.min(list.children.length - 1, index));
}

function centerSlide(list: HTMLUListElement, index: number, behavior: ScrollBehavior = "auto") {
  const slide = list.children.item(index) as HTMLElement | null;
  if (!slide) return;
  list.scrollTo({ left: slide.offsetLeft + (slide.offsetWidth - list.clientWidth) / 2, behavior });
}

export function SchoolCarousel({ id, title, label, description, children }: {
  id: string;
  title: string;
  label: string;
  description?: string;
  children: ReactNode;
}) {
  const slides = Children.toArray(children).filter(isValidElement<SlideProps>);
  const count = slides.length;
  const rail = useRef<HTMLUListElement>(null);
  const active = useRef(count);
  const scrollTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const railId = useId();

  useLayoutEffect(() => {
    const list = rail.current;
    if (!list || count < 2) return;
    active.current = count;
    centerSlide(list, count);
    const observer = new ResizeObserver(() => centerSlide(list, active.current));
    observer.observe(list);
    return () => {
      observer.disconnect();
      clearTimeout(scrollTimer.current);
    };
  }, [count]);

  function settleScroll() {
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const list = rail.current;
      if (!list || count < 2) return;
      const index = nearestSlide(list);
      active.current = count + index % count;
      if (index !== active.current) centerSlide(list, active.current);
    }, 120);
  }

  function move(direction: -1 | 1) {
    const list = rail.current;
    if (!list || count < 2) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    centerSlide(list, nearestSlide(list) + direction, reducedMotion ? "auto" : "smooth");
  }

  function handleRailKey(event: KeyboardEvent<HTMLUListElement>) {
    if (event.currentTarget !== event.target) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    move(event.key === "ArrowLeft" ? -1 : 1);
  }

  return <section className={styles.carousel} id={id} aria-labelledby={id + "-title"}>
    <header className={styles.heading}>
      <h2 id={id + "-title"}>{title}</h2>
      {description && <p>{description}</p>}
    </header>
    <ul id={railId} ref={rail} className={styles.rail} tabIndex={0} role="list"
      aria-label={label} onScroll={settleScroll} onKeyDown={handleRailKey}>
      {[0, 1, 2].flatMap(group => slides.map(slide => cloneElement(slide, {
        key: group + ":" + slide.key,
        inert: group === 1 ? undefined : true,
        "aria-hidden": group === 1 ? undefined : true,
      })))}
    </ul>
    <div className={styles.controls}>
      <button type="button" aria-label="Предыдущая карточка" aria-controls={railId} onClick={() => move(-1)}>
        <span aria-hidden="true" />
      </button>
      <button type="button" aria-label="Следующая карточка" aria-controls={railId} onClick={() => move(1)}>
        <span aria-hidden="true" />
      </button>
    </div>
  </section>;
}
