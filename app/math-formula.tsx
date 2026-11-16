import katex from "katex";
import { maxFormulaLength } from "../lib/formula-presets";

export function renderFormula(latex: string, display = false) {
  if (!latex.trim() || latex.length > maxFormulaLength) return null;
  try {
    return katex.renderToString(latex, {
      displayMode: display,
      strict: "ignore",
      trust: false,
      maxSize: 12,
      maxExpand: 200,
    });
  } catch {
    return null;
  }
}

export function MathFormula({ latex, display }: { latex: string; display: boolean }) {
  const html = renderFormula(latex, display);
  return <span className={display ? "math-formula math-formula-display" : "math-formula"}>
    {html ? <span dangerouslySetInnerHTML={{ __html: html }} /> : latex}
  </span>;
}
