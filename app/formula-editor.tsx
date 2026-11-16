"use client";

import { useState } from "react";
import { mergeAttributes, Node, ReactNodeViewRenderer, useEditorState, type Editor } from "@tiptap/react";
import { closeHistory } from "@tiptap/pm/history";
import { NodeSelection, Plugin, TextSelection } from "@tiptap/pm/state";
import { changeFormulaAt, editableFormulaFields, emptyFormula, formulaAt, formulaParts, formulaPresets, formulaSource, maxFormulaLength, maxGridSize, readFormulaFields, removeFormulaPart, replaceFormulaValue, resizeFormulaGrid, type FormulaFields, type FormulaPreset } from "../lib/formula-presets";
import { activeFormulaInput, focusFormulaInput, formulaInput } from "./formula-input";
import { InlineFormula } from "./inline-formula";
import { renderFormula } from "./math-formula";

export const FormulaNode = Node.create({
  name: "mathFormula",
  inline: true,
  group: "inline",
  atom: true,
  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: element => element.getAttribute("data-latex") ?? "",
        renderHTML: attrs => ({ "data-latex": formulaSource(attrs) }),
      },
      preset: {
        default: null,
        parseHTML: element => element.getAttribute("data-formula-preset"),
        renderHTML: attrs => {
          const form = readFormulaFields(attrs);
          return form ? { "data-formula-preset": form.preset, "data-formula-values": JSON.stringify(form.values) } : {};
        },
      },
      values: {
        default: null,
        parseHTML: element => {
          try { return JSON.parse(element.getAttribute("data-formula-values") ?? "null"); }
          catch { return null; }
        },
        rendered: false,
      },
      columns: {
        default: null,
        parseHTML: element => {
          const value = element.getAttribute("data-formula-columns");
          return value === null ? null : Number(value);
        },
        renderHTML: attrs => typeof attrs.columns === "number" ? { "data-formula-columns": attrs.columns } : {},
      },
      display: {
        default: false,
        parseHTML: element => element.hasAttribute("data-display"),
        renderHTML: attrs => attrs.display ? { "data-display": "" } : {},
      },
    };
  },
  parseHTML() { return [{ tag: "span[data-math-formula][data-latex]" }]; },
  renderHTML({ node, HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-math-formula": "" }), formulaSource(node.attrs)];
  },
  renderText({ node }) { return formulaSource(node.attrs); },
  addNodeView() { return ReactNodeViewRenderer(InlineFormula, { as: "span" }); },
  addProseMirrorPlugins() {
    const type = this.type;
    return [new Plugin({ props: { handleKeyDown(view, event) {
      const { selection } = view.state;
      if (event.key !== "Enter" || !(selection instanceof NodeSelection) || selection.node.type !== type) return false;
      const dom = view.nodeDOM(selection.from);
      if (!(dom instanceof HTMLElement)) return false;
      const field = formulaInput(dom, []);
      if (!field) return false;
      field.focus();
      return true;
    } } })];
  },
});

const symbols = [
  ["×", "Умножить"], ["±", "Плюс-минус"], ["≠", "Не равно"], ["≤", "Меньше или равно"],
  ["≥", "Больше или равно"], ["∈", "Принадлежит"], ["∣", "Делимость"], ["∞", "Бесконечность"],
  ["α", "Альфа"], ["β", "Бета"], ["γ", "Гамма"], ["θ", "Тета"], ["π", "Пи"], ["→", "Стрелка вправо"],
] as const;
const basicPresets: FormulaPreset[] = ["fraction", "root", "power", "subscript", "absolute", "sum", "matrix", "system"];
const functionPresets: FormulaPreset[] = ["integral", "product", "limit", "log", "vector", "binomial", "sin", "cos", "tan", "cot"];
const presetIcons = new Map([...basicPresets, ...functionPresets].map(key => [key, renderFormula(formulaPresets[key].symbol)] as const));

function formulaInsertRange(editor: Editor) {
  const { selection } = editor.state;
  const afterFormula = selection instanceof NodeSelection && selection.node.type.name === FormulaNode.name;
  return { from: afterFormula ? selection.to : selection.from, to: selection.to };
}

function trailingNumber(text: string) {
  return /\d+(?:[.,]\d+)?$/.exec(text)?.[0] ?? "";
}

function powerBase(editor: Editor) {
  const { selection } = editor.state;
  if (!(selection instanceof TextSelection) || !selection.$from.sameParent(selection.$to)) return null;
  if (selection.empty) {
    const before = selection.$from.nodeBefore;
    const base = before?.isText ? trailingNumber(before.text ?? "") : "";
    return base ? { base, range: { from: selection.from - base.length, to: selection.to } } : null;
  }
  const base = selection.$from.parent.textBetween(selection.$from.parentOffset, selection.$to.parentOffset, "", "\ufffc").trim();
  return base && !base.includes("\ufffc") ? { base, range: { from: selection.from, to: selection.to } } : null;
}

export function FormulaTools({ editor }: { editor: Editor | null }) {
  const [notice, setNotice] = useState("");
  const selection = useEditorState({ editor, selector: ({ editor }) => {
    const selected = editor?.state.selection;
    const formula = selected instanceof NodeSelection && selected.node.type.name === FormulaNode.name ? selected : null;
    const attrs = formula?.node.attrs;
    const fields = attrs && editableFormulaFields(attrs);
    const path = editor && formula ? activeFormulaInput(editor)?.path ?? [] : [];
    const active = fields && formulaAt(fields, path);
    const grid = active && "columns" in active
      ? { preset: active.preset, rows: active.values.length / active.columns, columns: active.columns }
      : null;
    return {
      inCode: !!editor?.isActive("codeBlock"),
      formulaPos: formula?.from ?? null,
      display: attrs?.display === true,
      grid,
      path,
    };
  } });
  const disabled = !editor || selection?.inCode;
  const formulaPos = selection?.formulaPos ?? null;
  const grid = selection?.grid;
  function commit(fields: FormulaFields) {
    if (!editor || formulaPos === null) return false;
    const { tr } = editor.state;
    const node = tr.doc.nodeAt(formulaPos);
    if (node?.type.name !== FormulaNode.name) return false;
    if (!readFormulaFields(fields)) {
      setNotice("Формула стала слишком сложной. Сократите вложенность.");
      return false;
    }
    setNotice("");
    tr.setNodeMarkup(formulaPos, undefined, { ...node.attrs, ...fields, latex: "" });
    tr.setSelection(NodeSelection.create(tr.doc, formulaPos));
    editor.view.dispatch(closeHistory(tr));
    return true;
  }

  function insertInField(insertion: FormulaFields | string) {
    if (!editor || formulaPos === null) return false;
    const address = activeFormulaInput(editor);
    const node = editor.state.doc.nodeAt(formulaPos);
    if (!address || node?.type.name !== FormulaNode.name) return false;
    const root = editableFormulaFields(node.attrs);
    const { path, field, part, input } = address;
    const active = root && formulaAt(root, path);
    const value = active?.values[field];
    if (!root || !active || value === undefined) return false;
    const parts = formulaParts(value);
    const text = parts[part];
    if (typeof text !== "string") return false;
    let start = input.selectionStart ?? text.length;
    const end = input.selectionEnd ?? start;
    if (typeof insertion !== "string" && insertion.preset === "power" && start === end) {
      start -= trailingNumber(text.slice(0, start)).length;
    }
    const before = text.slice(0, start);
    const after = text.slice(end);

    if (typeof insertion === "string") {
      const nextText = before + insertion + after;
      if (nextText.length > maxFormulaLength) return true;
      const next = typeof value === "string" ? nextText : parts.map((item, i) => i === part ? nextText : item);
      if (commit(changeFormulaAt(root, path, form => replaceFormulaValue(form, field, next)))) {
        focusFormulaInput(editor, formulaPos, path, field, part, start + insertion.length);
      }
    } else {
      const selected = text.slice(start, end);
      const nested = selected ? replaceFormulaValue(insertion, 0, selected) : insertion;
      const next = [...parts.slice(0, part), before, nested, after, ...parts.slice(part + 1)];
      if (commit(changeFormulaAt(root, path, form => replaceFormulaValue(form, field, next)))) {
        focusFormulaInput(editor, formulaPos, [...path, field, part + 1], selected && insertion.preset === "power" ? 1 : undefined);
      }
    }
    return true;
  }

  function insertPreset(preset: FormulaPreset) {
    if (!editor) return;
    const attrs = emptyFormula(preset);
    if (insertInField(attrs)) return;
    setNotice("");
    const existing = preset === "power" ? powerBase(editor) : null;
    const inserted = editor.chain().command(({ tr }) => { closeHistory(tr); return true; })
      .insertContentAt(existing?.range ?? formulaInsertRange(editor), {
        type: FormulaNode.name, attrs: existing ? replaceFormulaValue(attrs, 0, existing.base) : attrs,
      }).run();
    if (!inserted) return;
    const { $from } = editor.state.selection;
    const node = $from.nodeBefore;
    if (node?.type.name !== FormulaNode.name || node.attrs.preset !== preset) return;
    focusFormulaInput(editor, $from.pos - node.nodeSize, [], existing ? 1 : undefined);
  }

  function resizeGrid(rows: number, columns: number, focusIndex: number) {
    if (!editor || formulaPos === null) return;
    const node = editor.state.doc.nodeAt(formulaPos);
    if (node?.type.name !== FormulaNode.name) return;
    const root = editableFormulaFields(node.attrs);
    const path = selection?.path ?? [];
    const active = root && formulaAt(root, path);
    if (!root || !active || !("columns" in active)) return;
    if (commit(changeFormulaAt(root, path, () => resizeFormulaGrid(active, rows, columns)))) {
      focusFormulaInput(editor, formulaPos, path, focusIndex);
    }
  }

  function removeNested() {
    if (!editor || formulaPos === null) return;
    const node = editor.state.doc.nodeAt(formulaPos);
    const path = selection?.path;
    if (node?.type.name !== FormulaNode.name || !path?.length) return;
    const root = editableFormulaFields(node.attrs);
    const parentPath = path.slice(0, -2);
    const parent = root && formulaAt(root, parentPath);
    const [field, part] = path.slice(-2);
    const next = parent && removeFormulaPart(parent, field, part);
    if (root && next && commit(changeFormulaAt(root, parentPath, () => next.form))) {
      focusFormulaInput(editor, formulaPos, parentPath, field, part - 1, next.caret);
    }
  }

  function addSymbol(symbol: string) {
    if (!editor || insertInField(symbol)) return;
    editor.chain().focus().insertContentAt(formulaInsertRange(editor), { type: "text", text: symbol }).run();
  }

  function toggleDisplay() {
    if (!editor || formulaPos === null) return;
    const { tr } = editor.state;
    const node = tr.doc.nodeAt(formulaPos);
    if (node?.type.name !== FormulaNode.name) return;
    tr.setNodeMarkup(formulaPos, undefined, { ...node.attrs, display: !node.attrs.display });
    tr.setSelection(NodeSelection.create(tr.doc, formulaPos));
    editor.view.dispatch(closeHistory(tr));
  }

  function presetButton(preset: FormulaPreset) {
    const { label } = formulaPresets[preset];
    return <button key={preset} type="button" title={label} aria-label={label} disabled={disabled}
      onMouseDown={event => event.preventDefault()} onClick={() => insertPreset(preset)}>
      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: presetIcons.get(preset) ?? "" }} />
    </button>;
  }

  return <div className="text-tools math-tools" role="group" aria-label="Математические формулы">
    <div className="formula-tool-group" role="group" aria-label="Основные формулы">
      <span className="editor-tools-label">Формулы</span>
      <div className="formula-palette formula-basic">{basicPresets.map(presetButton)}</div>
    </div>
    <div className="formula-tool-group" role="group" aria-label="Функции">
      <span className="editor-tools-label">Функции</span>
      <div className="formula-palette">{functionPresets.map(presetButton)}</div>
    </div>
    <div className="formula-tool-group" role="group" aria-label="Символы">
      <span className="editor-tools-label">Символы</span>
      <div className="formula-palette formula-symbols">
        {symbols.map(([symbol, label]) => <button key={symbol} type="button" title={label} aria-label={label}
          disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => addSymbol(symbol)}>{symbol}</button>)}
      </div>
    </div>
    {formulaPos !== null && <div className="formula-tool-group" role="group" aria-label="Выбранная формула">
      {grid && <div className="formula-size-tools" role="group" aria-label="Размер формулы">
        <FormulaSize label={grid.preset === "matrix" ? "Строки" : "Уравнения"} count={grid.rows} minimum={grid.preset === "matrix" ? 1 : 2}
          item={grid.preset === "matrix" ? "строку" : "уравнение"}
          remove={grid.preset === "matrix" ? "Убрать последнюю строку" : "Убрать последнее уравнение"}
          change={step => resizeGrid(grid.rows + step, grid.columns, (grid.rows + step - 1) * grid.columns)} />
        {grid.preset === "matrix" && <FormulaSize label="Столбцы" item="столбец" remove="Убрать последний столбец" count={grid.columns} minimum={1}
          change={step => resizeGrid(grid.rows, grid.columns + step, grid.columns + step - 1)} />}
      </div>}
      {selection?.path.length ? <button className="formula-display-toggle" type="button"
        onMouseDown={event => event.preventDefault()} onClick={removeNested}>Убрать вложенную формулу</button> :
        <button className="formula-display-toggle" type="button" aria-pressed={selection?.display}
          onMouseDown={event => event.preventDefault()} onClick={toggleDisplay}>На отдельной строке</button>}
    </div>}
    {notice && <small className="formula-paste-notice" role="status">{notice}</small>}
  </div>;
}

function FormulaSize({ label, item, remove, count, minimum, change }: {
  label: string; item: string; remove: string; count: number; minimum: number; change: (step: -1 | 1) => void;
}) {
  return <div className="formula-size-row">
    <span>{label} · {count}</span>
    <button type="button" aria-label={remove} title={remove}
      disabled={count <= minimum} onMouseDown={event => event.preventDefault()} onClick={() => change(-1)}>−</button>
    <button type="button" aria-label={"Добавить " + item} title={"Добавить " + item}
      disabled={count >= maxGridSize} onMouseDown={event => event.preventDefault()} onClick={() => change(1)}>+</button>
  </div>;
}
