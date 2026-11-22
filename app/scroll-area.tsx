"use client";

import { useEffect, useId, useRef, useState, type AriaRole, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject, type UIEventHandler } from "react";

type Axis = "vertical" | "horizontal";

function readScroll(element: Element, vertical: boolean) {
  const available = vertical ? element.clientHeight : element.clientWidth;
  const total = vertical ? element.scrollHeight : element.scrollWidth;
  const offset = vertical ? element.scrollTop : element.scrollLeft;
  return { available, total, offset, range: Math.max(0, total - available) };
}

function ScrollTrack({ label, controls, axis = "vertical", viewport, content }: {
  label: string;
  controls: string;
  axis?: Axis;
  viewport?: RefObject<HTMLDivElement | null>;
  content?: RefObject<HTMLDivElement | null>;
}) {
  const owner = useRef<Element | null>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const dragOffset = useRef<number | null>(null);
  const [metrics, setMetrics] = useState({ range: 0, position: 0, visible: 1 });
  const vertical = axis === "vertical";

  useEffect(() => {
    const element = viewport ? viewport.current : document.scrollingElement;
    if (!element) return;
    owner.current = element;
    const events = viewport ? element : window;
    const sync = () => {
      const { available, total, offset, range } = readScroll(element, vertical);
      const position = range ? Math.min(1, Math.max(0, offset / range)) : 0;
      const visible = total ? Math.min(1, available / total) : 1;
      setMetrics(previous => previous.range === range && previous.position === position && previous.visible === visible ?
        previous : { range, position, visible });
    };
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    const inner = viewport ? content?.current : document.body;
    if (inner) observer.observe(inner);
    events.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
    return () => {
      observer.disconnect();
      events.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      owner.current = null;
    };
  }, [content, vertical, viewport]);

  function scrollTo(value: number) {
    const element = owner.current;
    if (!element) return;
    if (vertical) element.scrollTop = value;
    else element.scrollLeft = value;
  }

  function part(event: PointerEvent<HTMLDivElement>, rect: DOMRect) {
    return vertical ? event.clientY - rect.top : event.clientX - rect.left;
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || !thumb.current || !owner.current || dragOffset.current === null) return;
    const rail = event.currentTarget.getBoundingClientRect();
    const handle = thumb.current.getBoundingClientRect();
    const space = vertical ? rail.height - handle.height : rail.width - handle.width;
    if (space > 0) scrollTo(readScroll(owner.current, vertical).range * (part(event, rail) - dragOffset.current) / space);
  }

  function start(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || !thumb.current) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const handle = thumb.current.getBoundingClientRect();
    dragOffset.current = thumb.current.contains(event.target as Node) ? part(event, handle) : (vertical ? handle.height : handle.width) / 2;
    move(event);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!owner.current || event.altKey || event.ctrlKey || event.metaKey) return;
    const { available, offset, range } = readScroll(owner.current, vertical);
    const step = 40;
    const keys: Record<string, number> = {
      [vertical ? "ArrowUp" : "ArrowLeft"]: offset - step,
      [vertical ? "ArrowDown" : "ArrowRight"]: offset + step,
      PageUp: offset - available,
      PageDown: offset + available,
      Home: 0,
      End: range,
    };
    if (!Object.hasOwn(keys, event.key)) return;
    event.preventDefault();
    scrollTo(keys[event.key]);
  }

  const overflowing = metrics.range > 0;
  return <div className="scroll-track" data-axis={axis} data-overflow={overflowing}
    role="scrollbar" aria-label={label} aria-controls={controls} aria-orientation={axis}
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(metrics.position * 100)} tabIndex={overflowing ? 0 : -1}
    style={{ "--scroll-position": metrics.position * 100 + "%", "--scroll-fraction": metrics.visible * 100 + "%" } as CSSProperties}
    onPointerDown={start} onPointerMove={move} onLostPointerCapture={() => { dragOffset.current = null; }} onKeyDown={handleKeyDown}>
    <span className="scroll-thumb" ref={thumb} />
  </div>;
}

export function PageScrollbar() {
  return <div className="page-scrollbar"><ScrollTrack label="Прокрутка страницы" controls="olimpik-page" /></div>;
}

export function ScrollArea({ label, axis = "vertical", className, viewportClassName, contentClassName, role = "region", scrollRef, onScroll, children }: {
  label: string;
  axis?: Axis;
  className?: string;
  viewportClassName?: string;
  contentClassName?: string;
  role?: AriaRole;
  scrollRef?: RefObject<HTMLDivElement | null>;
  onScroll?: UIEventHandler<HTMLDivElement>;
  children: ReactNode;
}) {
  const id = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  return <div className={"scroll-area" + (className ? " " + className : "")} data-axis={axis}>
    <div id={id} role={role} aria-label={label} tabIndex={0} className={"scroll-viewport" + (viewportClassName ? " " + viewportClassName : "")}
      ref={element => {
        viewport.current = element;
        if (scrollRef) scrollRef.current = element;
      }} onScroll={onScroll}>
      <div ref={content} className={contentClassName ?? "scroll-content"}>{children}</div>
    </div>
    <ScrollTrack axis={axis} label={"Прокрутка · " + label} controls={id} viewport={viewport} content={content} />
  </div>;
}
