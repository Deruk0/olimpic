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
import { FormattedText } from "./formatted-text";
import { FormulaNode, FormulaTools } from "./formula-editor";
import { exceedsTextLimit, readRich, readUnderlineStyle, safeHref, writeRich, type UnderlineStyle } from "./rich-document";
import { EditorTableView, TableInsert, TableToolbar } from "./table-editor";
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
const UnderlineStyles = Extension.create({
  name: "olimpikUnderlineStyles",
  addGlobalAttributes() {
    return [{
      types: ["underline"],
      attributes: {
        style: {
          default: "solid",
          parseHTML: element => readUnderlineStyle(element.style.textDecorationStyle),
          renderHTML: attrs => {
            const style = readUnderlineStyle(attrs.style);
            return style === "solid" ? {} : { style: "text-decoration-style: " + style };
          },
        },
      },
    }];
  },
});
const extensions = [
  StarterKit.configure({ link: { openOnClick: false, isAllowedUri: safeHref }, heading: { levels: [1, 2] } }),
  TableKit.configure({ table: { resizable: true, allowTableNodeSelection: true, cellMinWidth: 76, View: EditorTableView } }),
  TaskList, TaskItem.configure({ nested: true }), Highlight, Indent, UnderlineStyles,
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
  const [tableSetup, setTableSetup] = useState<HTMLDivElement | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [...extensions, FormulaNode],
    editorProps: { attributes: { role: "textbox", "aria-multiline": "true", "aria-labelledby": id } },
    onUpdate({ editor }) {
      const doc = editor.getJSON();
      const next = editor.isEmpty ? "" : writeRich(doc);
      if (exceedsTextLimit(next, maxLength)) {
        if (accepted.current) editor.chain().setMeta("addToHistory", false).setContent(accepted.current, { emitUpdate: false }).run();
        setNotice("Достигнут лимит поля.");
        return;
      }
      accepted.current = doc;
      last.current = next;
      setNotice(current => current === "Достигнут лимит поля." ? "" : current);
      onChange(next);
    }
  });
  useEffect(() => {
    if (!editor || last.current === value) return;
    let cancelled = false;
    // Tiptap mounts React node views synchronously when replacing editor content.
    queueMicrotask(() => {
      if (cancelled || editor.isDestroyed || last.current === value) return;
      const content = (readRich(value) as JSONContent | null) ?? legacy.current?.innerHTML ?? "";
      editor.chain().setMeta("addToHistory", false).setContent(content, { emitUpdate: false }).run();
      accepted.current = editor.getJSON();
      last.current = value;
    });
    return () => { cancelled = true; };
  }, [editor, value]);
  const active = useEditorState({ editor, selector: ({editor}) => ({
    undo: !!editor?.can().undo(), bold: !!editor?.isActive("bold"), italic: !!editor?.isActive("italic"),
    underline: ["solid", "double", "dashed"].find(style => editor?.isActive("underline", { style })),
    strike: !!editor?.isActive("strike"),
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
  const toggleUnderline = (style: UnderlineStyle) => editor?.chain().focus().toggleMark("underline", { style }).run();
  const tool = (icon: string, title: string, run: () => unknown, pressed?: boolean, disabled = !editor) =>
    <button type="button" title={title} aria-label={title} aria-pressed={pressed} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={run}><TextIcon name={icon} /></button>;
  return <div className="text-editor visual-editor">
    <label id={id} onClick={() => editor?.commands.focus()}>{label}</label>
    <div className="editor-layout">
      <FormulaTools editor={editor} />
      <EditorContent className="visual-text" style={{ minHeight: (rows === 2 ? 7 : Math.max(17, rows * 2)) + "rem" }} editor={editor} />
      <div className="text-tools format-tools" role="group" aria-label="Форматирование текста">
        {tool("B","Жирный",() => editor?.chain().focus().toggleBold().run(),active?.bold)}
        {tool("I","Курсив",() => editor?.chain().focus().toggleItalic().run(),active?.italic)}
        {tool("S","Зачёркнутый",() => editor?.chain().focus().toggleStrike().run(),active?.strike)}
        {tool("U", "Обычное подчёркивание", () => toggleUnderline("solid"), active?.underline === "solid")}
        {tool("U-double", "Двойное подчёркивание", () => toggleUnderline("double"), active?.underline === "double")}
        {tool("U-dashed", "Прерывистое подчёркивание", () => toggleUnderline("dashed"), active?.underline === "dashed")}
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
        <TableInsert editor={editor} panel={tableSetup} />
        {tool("undo", "Отменить последнее изменение", () => editor?.chain().focus().undo().run(), undefined, !active?.undo)}
      </div>
      <div className="table-setup" ref={setTableSetup} />
    </div>
    <TableToolbar editor={editor} />
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
