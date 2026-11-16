"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { createTable, TableView } from "@tiptap/extension-table";
import { useEditorState, type Editor } from "@tiptap/react";
import { closeHistory } from "@tiptap/pm/history";
import { Fragment } from "@tiptap/pm/model";
import { NodeSelection, Selection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { findTable, isInTable, selectedRect, TableMap } from "@tiptap/pm/tables";
import { TextIcon } from "./text-icons";

export class EditorTableView extends TableView {
  readonly controls = document.createElement("div");

  constructor(...args: ConstructorParameters<typeof TableView>) {
    super(...args);
    this.controls.contentEditable = "false";
    this.controls.className = "table-controls-slot";
    const scroll = document.createElement("div");
    scroll.className = "table-scroll";
    scroll.append(this.table);
    this.dom.append(this.controls, scroll);
  }

  stopEvent(event: Event) {
    return event.target instanceof Node && this.controls.contains(event.target);
  }
}

function currentTable({ selection }: EditorState) {
  if (selection instanceof NodeSelection && selection.node.type.spec.tableRole === "table") {
    return { pos: selection.from, node: selection.node, start: selection.from + 1 };
  }
  return findTable(selection.$head);
}

function separateTableEdit({ tr }: { tr: Transaction }) {
  closeHistory(tr);
  return true;
}

export function TableInsert({ editor, panel }: { editor: Editor | null; panel: HTMLDivElement | null }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState("3");
  const [columns, setColumns] = useState("3");
  const [header, setHeader] = useState(true);
  const validSize = (value: string, max: number) =>
    Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= max;
  const valid = validSize(rows, 20) && validSize(columns, 12);

  function insert() {
    if (!editor || !valid) return;
    const options = { rows: Number(rows), cols: Number(columns), withHeaderRow: header };
    const table = currentTable(editor.state);
    if (table) {
      const { tr, schema } = editor.state;
      const end = table.pos + table.node.nodeSize;
      tr.insert(end, createTable(schema, options.rows, options.cols, options.withHeaderRow));
      tr.setSelection(Selection.near(tr.doc.resolve(end + 1), 1));
      editor.view.dispatch(closeHistory(tr).scrollIntoView());
      editor.commands.focus();
    } else {
      editor.chain().focus().command(separateTableEdit).insertTable(options).run();
    }
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
      editor?.commands.focus();
    }
    if (event.key === "Enter" && event.target instanceof HTMLInputElement && event.target.type === "number") {
      event.preventDefault();
      insert();
    }
  }

  return <>
    <button className="table-insert-toggle" type="button" disabled={!editor} aria-expanded={open} aria-controls={open ? id : undefined}
      onMouseDown={event => event.preventDefault()} onClick={() => setOpen(!open)}>
      <TextIcon name="table" /> Таблица
    </button>
    {open && panel && createPortal(<div className="table-insert" id={id} role="group" aria-label="Вставка таблицы" onKeyDown={onKeyDown}>
      <label>Строки <input autoFocus type="number" min={1} max={20} value={rows} onChange={event => setRows(event.target.value)} /></label>
      <label>Столбцы <input type="number" min={1} max={12} value={columns} onChange={event => setColumns(event.target.value)} /></label>
      <label className="table-header-option"><input type="checkbox" checked={header} onChange={event => setHeader(event.target.checked)} /> Строка заголовков</label>
      <button type="button" disabled={!valid} onClick={insert}>Вставить</button>
      <button type="button" className="secondary" onClick={() => { setOpen(false); editor?.commands.focus(); }}>Отмена</button>
      {!valid && <small role="status">От 1 до 20 строк и от 1 до 12 столбцов.</small>}
    </div>, panel)}
  </>;
}

function tableSelection(state: EditorState) {
  const table = currentTable(state);
  if (!table) return null;
  const { selection } = state;
  const { width, height } = TableMap.get(table.node);
  const inside = selection.from >= table.start && selection.to < table.pos + table.node.nodeSize;
  if (!inside || !isInTable(state)) {
    return selection instanceof NodeSelection && selection.from === table.pos ? { pos: table.pos, width, height, range: null } : null;
  }
  const { top, bottom, left, right } = selectedRect(state);
  return { pos: table.pos, width, height, range: { top, bottom, left, right } };
}

export function TableToolbar({ editor }: { editor: Editor | null }) {
  const table = useEditorState({ editor, selector: ({ editor }) => editor ? tableSelection(editor.state) : null });
  if (!editor || !table) return null;
  const dom = editor.view.nodeDOM(table.pos);
  if (!(dom instanceof HTMLElement)) return null;
  const slot = dom.querySelector(":scope > .table-controls-slot");
  return slot && createPortal(<TableActions editor={editor} table={table} />, slot);
}

function TableActions({ editor, table }: { editor: Editor; table: NonNullable<ReturnType<typeof tableSelection>> }) {
  const [panel, setPanel] = useState<"columns" | "table" | "delete" | null>(null);
  const panelId = useId();
  const { pos, width, height, range } = table;
  const position = editor.state.doc.resolve(pos);
  const index = position.index();
  const topLevel = position.depth === 0;
  const formatRange = (from: number, to: number) => to === from + 1 ? String(to) : `${from + 1}–${to}`;
  const edit = () => editor.chain().focus().command(separateTableEdit);

  function addRow(before: boolean) {
    if (!range) return;
    const chain = edit();
    (before ? chain.addRowBefore() : chain.addRowAfter()).command(({ tr }) => {
      const node = tr.doc.nodeAt(pos);
      if (!node) return false;
      const map = TableMap.get(node);
      const row = before ? range.top : range.bottom;
      const cell = map.map[row * map.width + range.left];
      tr.setSelection(Selection.near(tr.doc.resolve(pos + cell + 2), 1)).scrollIntoView();
      return true;
    }).run();
  }

  function move(step: -1 | 1) {
    const { doc, tr, selection } = editor.state;
    if (!topLevel || index + step < 0 || index + step >= doc.childCount) return;
    const left = step < 0 ? doc.child(index - 1) : doc.child(index);
    const right = step < 0 ? doc.child(index) : doc.child(index + 1);
    const start = step < 0 ? pos - left.nodeSize : pos;
    tr.replaceWith(start, start + left.nodeSize + right.nodeSize, Fragment.fromArray([right, left]));
    const moved = step < 0 ? start : start + right.nodeSize;
    const next = selection instanceof NodeSelection && selection.from === pos
      ? NodeSelection.create(tr.doc, moved)
      : Selection.near(tr.doc.resolve(moved + selection.head - pos), 1);
    editor.view.dispatch(closeHistory(tr).setSelection(next).scrollIntoView());
    close();
  }

  function close() {
    setPanel(null);
    editor.commands.focus();
  }

  return <div className="table-controls" role="group" aria-label="Редактирование таблицы"
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
    <div className="table-controls-bar">
      <span className="table-controls-position">
        {range ? `${range.bottom - range.top === 1 ? "Строка" : "Строки"} ${formatRange(range.top, range.bottom)} из ${height}` : `Таблица ${height} × ${width}`}
      </span>
      {range && <>
        <button type="button" onClick={() => addRow(true)}>+ Строка выше</button>
        <button type="button" onClick={() => addRow(false)}>+ Строка ниже</button>
        <button type="button" className="table-remove" disabled={range.bottom - range.top === height}
          title={range.bottom - range.top === height ? "Чтобы удалить все строки, используйте меню «Таблица»." : undefined}
          onClick={() => edit().deleteRow().run()}>Удалить {range.bottom - range.top === 1 ? "строку" : "строки"}</button>
        <button type="button" aria-expanded={panel === "columns"} aria-controls={panel === "columns" ? panelId : undefined}
          onClick={() => setPanel(panel === "columns" ? null : "columns")}>Столбцы ▾</button>
      </>}
      <button type="button" aria-expanded={panel === "table" || panel === "delete"} aria-controls={panel === "table" || panel === "delete" ? panelId : undefined}
        onClick={() => setPanel(panel === "table" || panel === "delete" ? null : "table")}>Таблица ▾</button>
    </div>
    {panel && <div className="table-controls-panel" id={panelId}>
      {panel === "columns" && range && <>
        <span className="table-controls-position">{range.right - range.left === 1 ? "Столбец" : "Столбцы"} {formatRange(range.left, range.right)} из {width}</span>
        <button type="button" onClick={() => { edit().addColumnBefore().run(); setPanel(null); }}>+ Столбец слева</button>
        <button type="button" onClick={() => { edit().addColumnAfter().run(); setPanel(null); }}>+ Столбец справа</button>
        <button type="button" className="table-remove" disabled={range.right - range.left === width}
          title={range.right - range.left === width ? "Чтобы удалить все столбцы, используйте меню «Таблица»." : undefined}
          onClick={() => { edit().deleteColumn().run(); setPanel(null); }}>Удалить {range.right - range.left === 1 ? "столбец" : "столбцы"}</button>
      </>}
      {panel === "table" && <>
        <button type="button" disabled={!topLevel || index === 0} onClick={() => move(-1)}>Переместить выше</button>
        <button type="button" disabled={!topLevel || index === editor.state.doc.childCount - 1} onClick={() => move(1)}>Переместить ниже</button>
        <button type="button" className="table-remove" onClick={() => setPanel("delete")}>Удалить таблицу…</button>
      </>}
      {panel === "delete" && <>
        <span>Удалить таблицу со всем содержимым?</span>
        <button type="button" className="table-remove" onClick={() => {
          const chain = edit();
          (range ? chain.deleteTable() : chain.deleteSelection()).run();
          setPanel(null);
        }}>Удалить таблицу</button>
        <button type="button" autoFocus onClick={close}>Отмена</button>
      </>}
    </div>}
  </div>;
}
