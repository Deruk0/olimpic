"use client";

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { closeHistory } from "@tiptap/pm/history";
import { NodeSelection, Selection } from "@tiptap/pm/state";
import { changeFormulaAt, editableFormulaFields, formulaAt, formulaFieldLabel, formulaParts, maxFormulaLength, maxGridSize, removeFormulaPart, replaceFormulaValue, resizeFormulaGrid, trigFunctions, type FormulaFields, type FormulaPath } from "../lib/formula-presets";
import { focusFormulaInput, formulaInput } from "./formula-input";
import { renderFormula } from "./math-formula";

export function InlineFormula({ editor, node, getPos }: NodeViewProps) {
  const latex = typeof node.attrs.latex === "string" ? node.attrs.latex : "";
  const formula = editableFormulaFields(node.attrs);
  const wrapper = useRef<HTMLSpanElement>(null);
  const startFieldEdit = useRef(true);
  const [pasteNotice, setPasteNotice] = useState("");
  const display = node.attrs.display === true;

  function exit(after: boolean) {
    const pos = getPos();
    if (typeof pos !== "number") return;
    const { tr } = editor.state;
    editor.view.dispatch(tr.setSelection(Selection.near(tr.doc.resolve(pos + (after ? node.nodeSize : 0)), after ? 1 : -1)));
    editor.view.focus();
  }

  function onSlotKey(event: KeyboardEvent<HTMLInputElement>, path: FormulaPath, index: number, part: number) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" || event.key === "Escape") {
      event.preventDefault();
      if (event.key === "Enter" && path.length && wrapper.current) {
        const [parentField, nestedPart] = path.slice(-2);
        const next = formulaInput(wrapper.current, path.slice(0, -2), parentField, nestedPart + 1);
        if (next) {
          next.focus();
          next.setSelectionRange(0, 0);
          return;
        }
      }
      exit(true);
    } else if (event.key === "Tab") {
      const inputs = Array.from(wrapper.current?.querySelectorAll("input") ?? []);
      const current = inputs.indexOf(event.currentTarget);
      const next = inputs[current + (event.shiftKey ? -1 : 1)];
      event.preventDefault();
      if (next) next.focus();
      else exit(!event.shiftKey);
    } else if (event.key === "Backspace" || event.key === "Delete") {
      const { selectionStart, selectionEnd, value } = event.currentTarget;
      if (selectionStart !== selectionEnd || selectionStart !== (event.key === "Backspace" ? 0 : value.length)) return;
      const previous = currentFields();
      const form = previous && formulaAt(previous, path);
      const nested = part + (event.key === "Backspace" ? -1 : 1);
      const next = form && removeFormulaPart(form, index, nested);
      const pos = getPos();
      if (!previous || !next || typeof pos !== "number") return;
      event.preventDefault();
      update(changeFormulaAt(previous, path, () => next.form), true);
      focusFormulaInput(editor, pos, path, index, nested - 1, next.caret);
    }
  }

  function update(fields: FormulaFields, separate = startFieldEdit.current) {
    const pos = getPos();
    if (typeof pos !== "number") return;
    const { tr } = editor.state;
    const current = tr.doc.nodeAt(pos);
    if (current?.type !== node.type) return;
    tr.setNodeMarkup(pos, undefined, { ...current.attrs, ...fields, latex: "" });
    tr.setSelection(NodeSelection.create(tr.doc, pos));
    if (separate) closeHistory(tr);
    startFieldEdit.current = false;
    setPasteNotice("");
    editor.view.dispatch(tr);
  }

  function currentFields() {
    const pos = getPos();
    const current = typeof pos === "number" ? editor.state.doc.nodeAt(pos) : null;
    return current?.type === node.type ? editableFormulaFields(current.attrs) : null;
  }

  function pasteGrid(event: ClipboardEvent<HTMLInputElement>, path: FormulaPath, index: number) {
    const root = currentFields();
    const fields = root && formulaAt(root, path);
    const text = event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n").replace(/\n+$/, "");
    if (!root || !fields || !("columns" in fields) || !/[\t\n]/.test(text)) return;
    event.preventDefault();
    const tooLarge = "Вставка превышает размер формулы. Попробуйте вставить меньший фрагмент.";
    if (text.length > maxFormulaLength) { setPasteNotice(tooLarge); return; }
    const lines = text.split("\n").map(line => fields.preset === "matrix" ? line.split("\t") : [line.replaceAll("\t", " ")]);
    const startRow = Math.floor(index / fields.columns);
    const startColumn = index % fields.columns;
    const rows = Math.max(fields.values.length / fields.columns, startRow + lines.length);
    const columns = Math.max(fields.columns, startColumn + Math.max(...lines.map(line => line.length)));
    if (rows > maxGridSize || columns > maxGridSize) {
      setPasteNotice(tooLarge);
      return;
    }
    const next = resizeFormulaGrid(fields, rows, columns);
    lines.forEach((line, y) => line.forEach((value, x) => {
      next.values[(startRow + y) * columns + startColumn + x] = value.trim();
    }));
    update(changeFormulaAt(root, path, () => next), true);
    const focus = (startRow + lines.length - 1) * columns + startColumn + lines[lines.length - 1].length - 1;
    const pos = getPos();
    if (typeof pos === "number") focusFormulaInput(editor, pos, path, focus);
  }

  function focusSlot() {
    startFieldEdit.current = true;
    const pos = getPos();
    if (typeof pos !== "number") return;
    const { tr } = editor.state;
    editor.view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, pos)));
  }

  if (!formula) {
    const html = renderFormula(latex, display);
    return <NodeViewWrapper as="span" contentEditable={false} data-math-formula=""
      className={display ? "math-formula math-formula-display" : "math-formula"}>
      {html ? <span dangerouslySetInnerHTML={{ __html: html }} /> : latex}
    </NodeViewWrapper>;
  }

  function textPart(path: FormulaPath, index: number, part: number, label: string, value: string, className = "", key = index) {
    const preview = value.trim() ? renderFormula(value) : null;
    return <span key={key} className={"formula-slot " + className} data-empty={!value.trim() ? "" : undefined} title={label}>
      <span className="formula-slot-view" aria-hidden="true">
        {preview ? <span dangerouslySetInnerHTML={{ __html: preview }} /> : value || "\u00a0"}
      </span>
      <input type="text" aria-label={label} value={value} maxLength={maxFormulaLength} autoComplete="off" spellCheck={false}
        aria-invalid={!!value.trim() && !preview || undefined} size={Math.min(28, Math.max(2, Array.from(value).length + 1))}
        data-primary={index === 0 && part === 0 ? "" : undefined} data-formula-path={path.join(".")}
        data-formula-field={index} data-formula-part={part} onFocus={focusSlot}
        onKeyDown={event => onSlotKey(event, path, index, part)} onPaste={event => pasteGrid(event, path, index)} onChange={event => {
          const fields = currentFields();
          if (!fields) return;
          const text = event.target.value;
          update(changeFormulaAt(fields, path, form => {
            const previous = form.values[index];
            const next = typeof previous === "string" ? text : previous.map((item, i) => i === part ? text : item);
            return replaceFormulaValue(form, index, next);
          }));
        }} />
    </span>;
  }

  function shape(form: FormulaFields, path: FormulaPath) {
    const { preset, values } = form;
    const slot = (index: number, className = "") => {
      const value = values[index];
      const label = formulaFieldLabel(form, index);
      if (typeof value === "string") return textPart(path, index, 0, label, value, className);
      return <span key={index} className={"formula-composite " + className}>
        {formulaParts(value).map((part, partIndex) => typeof part === "string"
          ? textPart(path, index, partIndex, label + " · текст " + (partIndex / 2 + 1), part, "formula-composite-text", partIndex)
          : <span className="formula-nested" key={partIndex} data-formula-preset={part.preset}>
            {shape(part, [...path, index, partIndex])}
          </span>)}
      </span>;
    };
    return <span className={"formula-shape formula-shape-" + preset}>
        {preset === "root" && <>
          {slot(1, "formula-root-degree")}
          <span className="formula-root-sign" aria-hidden="true" />
          <span className="formula-root-body">{slot(0)}</span>
        </>}
        {preset === "fraction" && <>{slot(0, "formula-numerator")}{slot(1)}</>}
        {preset === "power" && <>{values[2] ? slot(2) : null}{slot(0)}{slot(1, "formula-super")}</>}
        {preset === "subscript" && <>{slot(0)}{slot(1, "formula-sub")}</>}
        {preset === "absolute" && <><span aria-hidden="true">|</span>{slot(0)}<span aria-hidden="true">|</span></>}
        {(preset === "sum" || preset === "product" || preset === "integral") && <>
          <span className="formula-sum-limits">{slot(2)}<span aria-hidden="true">{preset === "sum" ? "∑" : preset === "product" ? "∏" : "∫"}</span>{slot(1)}</span>
          {slot(0)}
          {preset === "integral" && <span className="formula-differential"><span aria-hidden="true">d</span>{slot(3)}</span>}
        </>}
        {preset === "limit" && <>
          <span className="formula-limit-operator">
            <span aria-hidden="true">lim</span>
            <span className="formula-limit-target">{slot(1)}<span aria-hidden="true">→</span>{slot(2)}</span>
          </span>
          {slot(0)}
        </>}
        {preset === "log" && <>
          <span aria-hidden="true">log</span>{slot(1, "formula-sub")}
          <span aria-hidden="true">(</span>{slot(0)}<span aria-hidden="true">)</span>
        </>}
        {Object.hasOwn(trigFunctions, preset) && <>
          <span aria-hidden="true">{preset}(</span>{slot(0)}<span aria-hidden="true">)</span>
        </>}
        {preset === "vector" && <span className="formula-vector-arrow">{slot(0)}</span>}
        {preset === "binomial" && <>
          <span className="formula-matrix-bracket" aria-hidden="true" />
          <span className="formula-grid-fields">{slot(0)}{slot(1)}</span>
          <span className="formula-matrix-bracket" aria-hidden="true" />
        </>}
        {"columns" in form && <>
          {preset === "system"
            ? <span className="formula-system-brace" aria-hidden="true"><i /><i /><i /><i /></span>
            : <span className="formula-matrix-bracket" aria-hidden="true" />}
          <span className="formula-grid-fields"
            style={{ gridTemplateColumns: "repeat(" + form.columns + ", minmax(0, auto))" }}>
            {values.map((_, index) => slot(index))}
          </span>
          {preset === "matrix" && <span className="formula-matrix-bracket" aria-hidden="true" />}
        </>}
    </span>;
  }

  return <NodeViewWrapper as="span" contentEditable={false} data-math-formula="" data-formula-preset={formula.preset} ref={wrapper}
    className={display ? "formula-editable formula-editable-display" : "formula-editable"}>
    {shape(formula, [])}
    {pasteNotice && <small className="formula-paste-notice" role="status">{pasteNotice}</small>}
  </NodeViewWrapper>;
}
