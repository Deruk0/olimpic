import type { Editor } from "@tiptap/react";
import type { FormulaPath } from "../lib/formula-presets";

export function formulaInputAddress(input: HTMLInputElement) {
  const { formulaPath, formulaField, formulaPart } = input.dataset;
  if (formulaPath === undefined || formulaField === undefined || formulaPart === undefined) return null;
  return {
    path: formulaPath ? formulaPath.split(".").map(Number) : [],
    field: Number(formulaField),
    part: Number(formulaPart),
  };
}

export function formulaInput(root: Element, path: FormulaPath, field?: number, part = 0) {
  const selector = field === undefined ? "[data-primary]" : '[data-formula-field="' + field + '"][data-formula-part="' + part + '"]';
  return root.querySelector<HTMLInputElement>('input[data-formula-path="' + path.join(".") + '"]' + selector);
}

export function activeFormulaInput(editor: Editor) {
  if (typeof document === "undefined") return null;
  const input = document.activeElement;
  if (!(input instanceof HTMLInputElement) || !editor.view.dom?.contains(input)) return null;
  const address = formulaInputAddress(input);
  return address && { ...address, input };
}

export function focusFormulaInput(editor: Editor, pos: number, path: FormulaPath, field?: number, part = 0, caret?: number) {
  requestAnimationFrame(() => {
    if (editor.isDestroyed) return;
    const dom = editor.view.nodeDOM(pos);
    if (!(dom instanceof Element)) return;
    const input = formulaInput(dom, path, field, part);
    input?.focus();
    if (caret !== undefined) input?.setSelectionRange(caret, caret);
  });
}
