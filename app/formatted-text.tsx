import type { ReactNode } from "react";
import { readRich, RichDocument } from "./rich-document";

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|__[^_\n]+__|~~[^~\n]+~~|==[^=\n]+==|\[[^\]\n]+\]\([^\s)]+\))/g);
  return parts.map((part, index) => {
    if (index % 2 === 0) return part;
    if (part.startsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith("__")) return <u key={index}>{part.slice(2, -2)}</u>;
    if (part.startsWith("~~")) return <s key={index}>{part.slice(2, -2)}</s>;
    if (part.startsWith("==")) return <mark key={index}>{part.slice(2, -2)}</mark>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link && /^\/material-files\/[a-f0-9-]{36}$/.test(link[2])) return <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    if (link && /^https?:\/\//i.test(link[2]) && URL.canParse(link[2])) return <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    return part;
  });
}
const bullet = /^[-•] (.+)$/;
const ordered = /^\d+\. (.+)$/;
const checklist = /^- \[([ xX])\] (.*)$/;
const tableRow = /^\|.*\|$/;
const tableSeparator = /^\|(?:\s*:?-{3,}:?\s*\|)+$/;
const cells = (line: string) => line.slice(1, -1).split("|").map(cell => cell.trim());

export function FormattedText({ text }: { text?: string }) {
  if (!text) return null;
  const doc = readRich(text);
  if (doc) return <RichDocument doc={doc} />;
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const spaces = raw.match(/^ */)![0].length;
    const line = raw.slice(spaces);
    const key = i;
    if (!line.trim()) continue;
    const heading = /^(#{1,2}) (.+)$/.exec(line);
    const quote = /^> (.+)$/.exec(line);
    const list = bullet.test(line) ? bullet : ordered.test(line) ? ordered : null;
    if (tableRow.test(line) && tableSeparator.test(lines[i + 1] ?? "")) {
      const headings = cells(line);
      const rows: string[][] = [];
      i++;
      while (tableRow.test(lines[i + 1] ?? "")) rows.push(cells(lines[++i]));
      blocks.push(<div className="text-table" key={key}><table><thead><tr>{headings.map((cell, j) => <th scope="col" key={j}>{inline(cell)}</th>)}</tr></thead>
        <tbody>{rows.map((row, j) => <tr key={j}>{headings.map((_, k) => <td key={k}>{inline(row[k] ?? "")}</td>)}</tr>)}</tbody></table></div>);
    } else if (checklist.test(line)) {
      const items = [line.match(checklist)!];
      while (checklist.test(lines[i + 1] ?? "")) items.push(lines[++i].match(checklist)!);
      blocks.push(<ul className="text-checklist" key={key}>{items.map((item, j) => <li key={j}><input type="checkbox" checked={item[1] !== " "} disabled aria-label="Пункт списка" />{inline(item[2])}</li>)}</ul>);
    } else if (heading) {
      const Tag = heading[1].length === 1 ? "h3" : "h4";
      blocks.push(<Tag key={key}>{inline(heading[2])}</Tag>);
    } else if (quote) {
      blocks.push(<blockquote key={key}>{inline(quote[1])}</blockquote>);
    } else if (list) {
      const Tag = list === bullet ? "ul" : "ol";
      const items = [line.match(list)![1]];
      while (i + 1 < lines.length && lines[i + 1].match(/^ */)![0].length === spaces && list.test(lines[i + 1].slice(spaces)) && !checklist.test(lines[i + 1].slice(spaces))) items.push(lines[++i].slice(spaces).match(list)![1]);
      blocks.push(<Tag key={key} start={Tag === "ol" ? Number.parseInt(line, 10) : undefined} style={{marginInlineStart: Math.min(spaces, 24) + "ch"}}>{items.map((item, index) => <li key={index}>{inline(item)}</li>)}</Tag>);
    } else {
      blocks.push(<p key={key} style={{marginInlineStart: Math.min(spaces, 24) + "ch"}}>{inline(line)}</p>);
    }
  }
  return <div className="formatted-text">{blocks}</div>;
}
