import type { CSSProperties, ReactNode } from "react";

const prefix = "olimpik-rich:";
export type RichNode = { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: RichNode[]; content?: RichNode[] };
export function readRich(value: string): RichNode | null {
  if (!value.startsWith(prefix)) return null;
  try { const doc = JSON.parse(value.slice(prefix.length)); return doc?.type === "doc" && Array.isArray(doc.content) ? doc : null; } catch { return null; }
}
export const writeRich = (doc: RichNode) => prefix + JSON.stringify(doc);
export function exceedsTextLimit(value: string, max: number) {
  if (value.length <= max) return false;
  if (value.length > max * 8 + 6000) return true;
  const doc = readRich(value);
  if (!doc) return true;
  let length = 0;
  const stack = [doc];
  while (stack.length) {
    const node = stack.pop();
    if (typeof node?.text === "string") length += node.text.length;
    if (length > max) return true;
    if (Array.isArray(node?.content)) for (const child of node.content) stack.push(child);
  }
  return false;
}
export const isMaterialPath = (href: string) => /^\/material-files\/[a-f0-9-]{36}$/.test(href);
export const safeHref = (href: string) => isMaterialPath(href) || (/^https?:\/\//i.test(href) && URL.canParse(href));

export function referencesMaterial(value: string | undefined, path: string) {
  if (!value) return false;
  const doc = readRich(value);
  if (!doc) return value.includes("](" + path + ")");
  const stack = [doc];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (node.type === "image" && node.attrs?.src === path) return true;
    if (Array.isArray(node.marks) && node.marks.some(mark => mark?.type === "link" && mark.attrs?.href === path)) return true;
    if (Array.isArray(node.content)) stack.push(...node.content);
  }
  return false;
}

function render(node: RichNode, key: number, depth: number): ReactNode {
  if (!node || depth > 60) return null;
  const children = Array.isArray(node.content) ? node.content.map((child, i) => render(child, i, depth + 1)) : undefined;
  const indent = Math.min(12, Math.max(0, Number(node.attrs?.indent) || 0)) * 1.25;
  const align = node.attrs?.textAlign;
  const style: CSSProperties = { marginInlineStart: indent ? indent + "rem" : undefined, textAlign: align === "left" || align === "right" || align === "center" ? align : undefined };
  switch (node.type) {
    case "doc": return children;
    case "text": {
      let text: ReactNode = typeof node.text === "string" ? node.text : "";
      for (const mark of Array.isArray(node.marks) ? node.marks : []) {
        const href = mark.attrs?.href;
        if (mark.type === "bold") text = <strong>{text}</strong>;
        if (mark.type === "italic") text = <em>{text}</em>;
        if (mark.type === "underline") text = <u>{text}</u>;
        if (mark.type === "strike") text = <s>{text}</s>;
        if (mark.type === "highlight") text = <mark>{text}</mark>;
        if (mark.type === "code") text = <code>{text}</code>;
        if (mark.type === "link" && typeof href === "string" && safeHref(href)) text = <a href={href} target="_blank" rel="noopener noreferrer">{text}</a>;
      }
      return <span key={key}>{text}</span>;
    }
    case "paragraph": return <p key={key} style={style}>{children ?? <br />}</p>;
    case "heading": return node.attrs?.level === 2 ? <h4 key={key} style={style}>{children}</h4> : <h3 key={key} style={style}>{children}</h3>;
    case "blockquote": return <blockquote key={key}>{children}</blockquote>;
    case "bulletList": return <ul key={key}>{children}</ul>;
    case "orderedList": return <ol key={key} start={Number(node.attrs?.start) || 1}>{children}</ol>;
    case "listItem": return <li key={key}>{children}</li>;
    case "taskList": return <ul key={key} className="text-checklist" data-type="taskList">{children}</ul>;
    case "taskItem": return <li key={key} data-type="taskItem" data-checked={!!node.attrs?.checked}><label><input aria-label="Пункт списка" type="checkbox" disabled checked={!!node.attrs?.checked}/><span /></label><div>{children}</div></li>;
    case "table": return <div className="text-table" key={key}><table><tbody>{children}</tbody></table></div>;
    case "tableRow": return <tr key={key}>{children}</tr>;
    case "tableHeader":
    case "tableCell": {
      const Tag = node.type === "tableHeader" ? "th" : "td";
      const width = Array.isArray(node.attrs?.colwidth) ? Number(node.attrs.colwidth[0]) : 0;
      return <Tag key={key} colSpan={Math.min(100, Math.max(1, Number(node.attrs?.colspan) || 1))} rowSpan={Math.min(100, Math.max(1, Number(node.attrs?.rowspan) || 1))}
        style={width > 0 ? { minWidth: Math.min(width, 1500) } : undefined}>{children}</Tag>;
    }
    case "hardBreak": return <br key={key}/>;
    case "horizontalRule": return <hr key={key}/>;
    case "codeBlock": return <pre key={key}>{children}</pre>;
    case "image": {
      const src = node.attrs?.src;
      return typeof src === "string" && safeHref(src) ?
        <a key={key} className="material-photo" href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt={typeof node.attrs?.alt === "string" ? node.attrs.alt : "Фото к материалу"} loading="lazy"/></a> : null;
    }
    default: return null;
  }
}
export function RichDocument({ doc }: { doc: RichNode }) {
  return <div className="formatted-text">{render(doc, 0, 0)}</div>;
}
