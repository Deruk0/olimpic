"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { EditorContent, Extension, useEditor, useEditorState, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { Fragment } from "@tiptap/pm/model";
import { Selection } from "@tiptap/pm/state";
import { FormattedText } from "./formatted-text";
import { readRich, safeHref, writeRich } from "./rich-document";
import { TextIcon } from "./text-icons";

const Indent = Extension.create({
  name: "olimpikIndent",
  addGlobalAttributes() {
    return [{ types: ["paragraph", "heading"], attributes: { indent: {
      default: 0,
      parseHTML: element => Number(element.dataset.indent) || Math.round((Number.parseFloat(element.style.marginInlineStart) || 0) / 2),
      renderHTML: attributes => attributes.indent ? { "data-indent": attributes.indent, style: "margin-inline-start:" + (attributes.indent * 1.25) + "rem" } : {}
    } } }];
  }
});
const extensions = [
  StarterKit.configure({ link: { openOnClick: false, isAllowedUri: safeHref }, heading: { levels: [1, 2] } }),
  TableKit.configure({ table: { resizable: true, allowTableNodeSelection: true } }),
  TaskList, TaskItem.configure({ nested: true }), Highlight, Indent,
  TextAlign.configure({ types: ["paragraph", "heading"], alignments: ["left", "center", "right"] }),
  Image.configure({ allowBase64: false })
];

export function TextEditor({ label, name, value, onChange, maxLength, rows = 4 }: {
  label: ReactNode; name?: string; value: string; onChange: (value: string) => void; maxLength: number; rows?: number;
}) {
  const id = useId();
  const legacy = useRef<HTMLDivElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const last = useRef<string | undefined>(undefined);
  const accepted = useRef<ReturnType<NonNullable<ReturnType<typeof useEditor>>["getJSON"]> | null>(null);
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    editorProps: { attributes: { role: "textbox", "aria-multiline": "true", "aria-labelledby": id } },
    onUpdate({ editor }) {
      const doc = editor.getJSON();
      const next = editor.isEmpty ? "" : writeRich(doc);
      if (editor.getText().length > maxLength || next.length > maxLength * 8 + 6000) {
        if (accepted.current) editor.commands.setContent(accepted.current, { emitUpdate: false });
        setNotice("Достигнут лимит поля.");
        return;
      }
      accepted.current = doc;
      last.current = next;
      onChange(next);
    }
  });
  useEffect(() => {
    if (!editor || last.current === value) return;
    editor.commands.setContent((readRich(value) as JSONContent | null) ?? legacy.current?.innerHTML ?? "", { emitUpdate: false });
    accepted.current = editor.getJSON();
    last.current = value;
  }, [editor, value]);
  const active = useEditorState({ editor, selector: ({editor}) => ({
    table: !!editor?.isActive("table"), bold: !!editor?.isActive("bold"), italic: !!editor?.isActive("italic"),
    underline: !!editor?.isActive("underline"), strike: !!editor?.isActive("strike"),
    alignment: ["left","center","right"].find(value => editor?.isActive({ textAlign: value })) ?? "left"
  }) });
  function indent(step: number) {
    if (!editor) return;
    if (editor.isActive("listItem") || editor.isActive("taskItem")) {
      const item = editor.isActive("taskItem") ? "taskItem" : "listItem";
      if (step > 0 ? editor.commands.sinkListItem(item) : editor.commands.liftListItem(item)) return;
    }
    const { selection, doc, tr } = editor.state;
    doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (node.type.name === "paragraph" || node.type.name === "heading") {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: Math.min(12, Math.max(0, (node.attrs.indent || 0) + step)) });
      }
    });
    if (tr.docChanged) editor.view.dispatch(tr);
    editor.commands.focus();
  }
  function moveTable(step: number) {
    if (!editor) return;
    const { doc, tr, selection } = editor.state;
    const index = selection.$from.index(0);
    if (index + step < 0 || index + step >= doc.childCount || doc.maybeChild(index)?.type.name !== "table") return;
    const left = Math.min(index, index + step);
    let pos = 0;
    for (let i = 0; i < left; i++) pos += doc.child(i).nodeSize;
    const first = doc.child(left), second = doc.child(left + 1);
    const tableStart = step < 0 ? pos + first.nodeSize : pos;
    const offset = Math.max(1, selection.from - tableStart);
    tr.replaceWith(pos, pos + first.nodeSize + second.nodeSize, Fragment.fromArray([second, first]));
    tr.setSelection(Selection.near(tr.doc.resolve((step < 0 ? pos : pos + second.nodeSize) + offset), 1));
    editor.view.dispatch(tr.scrollIntoView());
    editor.commands.focus();
  }
  async function attach(file?: File) {
    if (!editor || !file) return;
    if (file.size > 4_000_000) { setNotice("Максимум 4 МБ на файл."); return; }
    setUploading(true);
    setNotice("Загрузка…");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/material-files", { method: "POST", body });
      if (!response.ok) throw Error();
      const { path, image } = await response.json();
      if (editor.isDestroyed || !safeHref(path)) return;
      if (image) editor.chain().focus().setImage({ src: path, alt: file.name }).run();
      else editor.chain().focus().insertContent({ type: "text", text: file.name, marks: [{ type: "link", attrs: { href: path } }] }).run();
      setNotice("Файл добавлен.");
    } catch { setNotice("Файл не удалось загрузить."); }
    finally { setUploading(false); }
  }
  const tool = (icon: string, title: string, run: () => unknown, pressed?: boolean, disabled = !editor) =>
    <button type="button" title={title} aria-label={title} aria-pressed={pressed} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={run}><TextIcon name={icon} /></button>;
  return <div className="text-editor visual-editor">
    <label id={id} onClick={() => editor?.commands.focus()}>{label}</label>
    <EditorContent className="visual-text" style={{ minHeight: Math.max(17, rows * 2) + "rem" }} editor={editor} />
    <div className="text-tools" role="group" aria-label="Форматирование текста">
      {tool("B","Жирный",() => editor?.chain().focus().toggleBold().run(),active?.bold)}
      {tool("I","Курсив",() => editor?.chain().focus().toggleItalic().run(),active?.italic)}
      {tool("U","Подчёркнутый",() => editor?.chain().focus().toggleUnderline().run(),active?.underline)}
      {tool("S","Зачёркнутый",() => editor?.chain().focus().toggleStrike().run(),active?.strike)}
      {tool("align-left","По левому краю",() => editor?.chain().focus().setTextAlign("left").run(),active?.alignment === "left")}
      {tool("align-center","По центру",() => editor?.chain().focus().setTextAlign("center").run(),active?.alignment === "center")}
      {tool("align-right","По правому краю",() => editor?.chain().focus().setTextAlign("right").run(),active?.alignment === "right")}
      {tool("H1","Заголовок",() => editor?.chain().focus().toggleHeading({level:1}).run())}
      {tool("H2","Подзаголовок",() => editor?.chain().focus().toggleHeading({level:2}).run())}
      {tool("•","Маркированный список",() => editor?.chain().focus().toggleBulletList().run())}
      {tool("1.","Нумерованный список",() => editor?.chain().focus().toggleOrderedList().run())}
      {tool("❝","Цитата",() => editor?.chain().focus().toggleBlockquote().run())}
      {tool("left","Уменьшить отступ",() => indent(-1))}
      {tool("right","Увеличить отступ",() => indent(1))}
      {tool("link","Ссылка",() => { setHref(editor?.getAttributes("link").href ?? ""); setLinkOpen(true); })}
      {tool("file","Прикрепить файл",() => upload.current?.click(),undefined,!editor || uploading)}
      {tool("table","Таблица",() => editor?.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run())}
    </div>
    {active?.table && <div className="controls table-actions" aria-label="Настройки таблицы">
      <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().addRowAfter().run()}>+ Строка</button>
      <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().addColumnAfter().run()}>+ Столбец</button>
      <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().deleteRow().run()}>− Строка</button>
      <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().deleteColumn().run()}>− Столбец</button>
      <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>moveTable(-1)}>Таблицу выше</button>
      <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>moveTable(1)}>Таблицу ниже</button>
      <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().deleteTable().run()}>Удалить таблицу</button>
    </div>}
    {linkOpen && <div className="controls text-link-editor"><input aria-label="Адрес ссылки" value={href} placeholder="https://…" onChange={e=>setHref(e.target.value)}/>
      <button type="button" onClick={() => {
        const address = href.trim();
        if (!editor || !safeHref(address)) { setNotice("Укажите корректную ссылку."); return; }
        if (editor.state.selection.empty && !editor.isActive("link")) editor.chain().focus().insertContent({type:"text",text:address,marks:[{type:"link",attrs:{href:address}}]}).run();
        else editor.chain().focus().extendMarkRange("link").setLink({href:address}).run();
        setLinkOpen(false); setNotice("");
      }}>Применить</button><button type="button" className="secondary" onClick={()=>setLinkOpen(false)}>Закрыть</button>
    </div>}
    <input ref={upload} type="file" hidden aria-label="Файл для материала" onChange={event => { void attach(event.target.files?.[0]); event.target.value = ""; }} />
    {name && <input type="hidden" name={name} value={value} />}
    <div hidden ref={legacy}>{!readRich(value) && <FormattedText text={value} />}</div>
    {notice && <small role="status">{notice}</small>}
  </div>;
}
