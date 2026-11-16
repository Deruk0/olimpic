export const maxFormulaLength = 1500;

type Field = { label: string; optional?: boolean };
type Preset = {
  label: string;
  symbol: string;
  fields: Field[];
  build: (values: string[]) => string;
};

export const trigFunctions = { sin: "Синус", cos: "Косинус", tan: "Тангенс", cot: "Котангенс" };

function trigPreset(name: keyof typeof trigFunctions): Preset {
  return {
    label: trigFunctions[name], symbol: "\\" + name,
    fields: [{ label: "Аргумент" }],
    build: ([argument]) => "\\" + name + "\\left(" + argument + "\\right)",
  };
}

function withLimits(operator: string, from: string, to: string) {
  return operator + (from ? "_{" + from + "}" : "") + (to ? "^{" + to + "}" : "");
}

const limits = [{ label: "Нижняя граница", optional: true }, { label: "Верхняя граница", optional: true }];

const fixedPresets = {
  fraction: {
    label: "Дробь", symbol: "\\frac{a}{b}",
    fields: [{ label: "Числитель" }, { label: "Знаменатель" }],
    build: ([top, bottom]) => "\\frac{" + top + "}{" + bottom + "}",
  },
  root: {
    label: "Корень", symbol: "\\sqrt[n]{x}",
    fields: [{ label: "Подкоренное выражение" }, { label: "Показатель корня", optional: true }],
    build: ([radicand, degree]) => "\\sqrt" + (degree ? "[{" + degree + "}]" : "") + "{" + radicand + "}",
  },
  power: {
    label: "Степень", symbol: "x^n",
    fields: [{ label: "Основание" }, { label: "Показатель степени" }],
    build: ([base, exponent, coefficient]) => {
      const simple = /^(?:[a-zA-Z]|\d+(?:[.,]\d+)?|\\[a-zA-Z]+)$/.test(base);
      const term = simple ? base : "\\left(" + base + "\\right)";
      return (coefficient ? coefficient + " " : "") + "{" + term + "}^{" + exponent + "}";
    },
  },
  subscript: {
    label: "Нижний индекс", symbol: "a_n",
    fields: [{ label: "Основание" }, { label: "Индекс" }],
    build: ([base, index]) => "{" + base + "}_{" + index + "}",
  },
  absolute: {
    label: "Модуль", symbol: "|x|",
    fields: [{ label: "Выражение под модулем" }],
    build: ([value]) => "\\left|" + value + "\\right|",
  },
  sum: {
    label: "Сумма", symbol: "\\sum",
    fields: [{ label: "Слагаемое" }, ...limits],
    build: ([term, from, to]) => withLimits("\\sum", from, to) + " {" + term + "}",
  },
  product: {
    label: "Произведение", symbol: "\\prod",
    fields: [{ label: "Множитель" }, ...limits],
    build: ([term, from, to]) => withLimits("\\prod", from, to) + " {" + term + "}",
  },
  integral: {
    label: "Интеграл", symbol: "\\int",
    fields: [{ label: "Подынтегральное выражение" }, ...limits, { label: "Переменная интегрирования" }],
    build: ([term, from, to, variable]) => withLimits("\\int", from, to) + " {" + term + "}\\,d{" + variable + "}",
  },
  limit: {
    label: "Предел", symbol: "\\lim",
    fields: [{ label: "Выражение под пределом" }, { label: "Переменная" }, { label: "К чему стремится" }],
    build: ([term, variable, target]) => "\\lim_{" + variable + "\\to " + target + "} {" + term + "}",
  },
  log: {
    label: "Логарифм", symbol: "\\log_a",
    fields: [{ label: "Аргумент логарифма" }, { label: "Основание логарифма", optional: true }],
    build: ([term, base]) => withLimits("\\log", base, "") + "\\left(" + term + "\\right)",
  },
  vector: {
    label: "Вектор", symbol: "\\overrightarrow{AB}",
    fields: [{ label: "Обозначение вектора" }],
    build: ([term]) => "\\overrightarrow{" + term + "}",
  },
  binomial: {
    label: "Биномиальный коэффициент", symbol: "\\binom{n}{k}",
    fields: [{ label: "Верхнее число" }, { label: "Нижнее число" }],
    build: ([top, bottom]) => "\\binom{" + top + "}{" + bottom + "}",
  },
  sin: trigPreset("sin"),
  cos: trigPreset("cos"),
  tan: trigPreset("tan"),
  cot: trigPreset("cot"),
} satisfies Record<string, Preset>;

export const formulaPresets = {
  ...fixedPresets,
  matrix: { label: "Матрица", symbol: "\\left(\\begin{smallmatrix}a&b\\\\c&d\\end{smallmatrix}\\right)" },
  system: { label: "Система уравнений", symbol: "\\left\\{\\begin{smallmatrix}x=1\\\\y=2\\end{smallmatrix}\\right." },
};
export type FormulaPreset = keyof typeof formulaPresets;
export type GridPreset = "matrix" | "system";
export type FormulaPart = string | FormulaFields;
export type FormulaValue = string | FormulaPart[];
export type FormulaGrid = { preset: GridPreset; values: FormulaValue[]; columns: number };
export type FormulaFields = { preset: keyof typeof fixedPresets; values: FormulaValue[] } | FormulaGrid;
export type FormulaPath = readonly number[];
export const maxGridSize = 8;
const maxFormulaDepth = 12;
const maxFormulaNodes = 160;

export function formulaParts(value: FormulaValue): FormulaPart[] {
  return typeof value === "string" ? [value] : value;
}

export function formulaAt(root: FormulaFields, path: FormulaPath): FormulaFields | undefined {
  let current: FormulaFields | undefined = root;
  for (let i = 0; current && i < path.length; i += 2) {
    const value: FormulaValue | undefined = current.values[path[i]];
    const part: FormulaPart | undefined = Array.isArray(value) ? value[path[i + 1]] : undefined;
    current = typeof part === "object" ? part : undefined;
  }
  return current;
}

export function changeFormulaAt(root: FormulaFields, path: FormulaPath, change: (form: FormulaFields) => FormulaFields): FormulaFields {
  if (!path.length) return change(root);
  const [field, index, ...rest] = path;
  const parts = root.values[field];
  if (!Array.isArray(parts)) return root;
  const child = parts[index];
  if (!child || typeof child === "string") return root;
  const values = root.values.slice();
  values[field] = parts.map((part, i) => i === index ? changeFormulaAt(child, rest, change) : part);
  return { ...root, values };
}

export function replaceFormulaValue(form: FormulaFields, index: number, value: FormulaValue): FormulaFields {
  const values = form.values.slice();
  values[index] = value;
  return { ...form, values };
}

export function removeFormulaPart(form: FormulaFields, field: number, index: number) {
  const value = form.values[field];
  if (!Array.isArray(value) || typeof value[index] !== "object") return null;
  const before = value[index - 1];
  const after = value[index + 1];
  if (typeof before !== "string" || typeof after !== "string") return null;
  const parts = [...value.slice(0, index - 1), before + after, ...value.slice(index + 2)];
  return {
    form: replaceFormulaValue(form, field, parts.length === 1 ? before + after : parts),
    caret: before.length,
  };
}
export function emptyFormula(preset: FormulaPreset): FormulaFields {
  if (preset === "matrix") return { preset, values: ["", "", "", ""], columns: 2 };
  if (preset === "system") return { preset, values: ["", ""], columns: 1 };
  const values = fixedPresets[preset].fields.map(() => "");
  if (preset === "integral") values[3] = "x";
  if (preset === "limit") values[1] = "x";
  return { preset, values };
}

export function formulaFieldLabel(form: FormulaFields, index: number) {
  if (form.preset === "matrix") {
    return "Строка " + (Math.floor(index / form.columns) + 1) + ", столбец " + (index % form.columns + 1);
  }
  if (form.preset === "system") return "Уравнение " + (index + 1);
  if (form.preset === "power" && index === 2) return "Коэффициент";
  return fixedPresets[form.preset].fields[index].label;
}

export function resizeFormulaGrid(form: FormulaGrid, rows: number, columns: number): FormulaGrid {
  const oldRows = form.values.length / form.columns;
  const values = Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    return row < oldRows && column < form.columns ? form.values[row * form.columns + column] : "";
  });
  return { ...form, columns, values };
}

export function readFormulaFields(attrs?: Record<string, unknown>): FormulaFields | null {
  return readFields(attrs, 0, { remaining: maxFormulaNodes });
}

function readFields(attrs: Record<string, unknown> | undefined, depth: number, budget: { remaining: number }): FormulaFields | null {
  if (depth > maxFormulaDepth || --budget.remaining < 0) return null;
  const { preset, values, columns } = attrs ?? {};
  if (typeof preset !== "string" || !Object.hasOwn(formulaPresets, preset) || !Array.isArray(values)) return null;
  const key = preset as FormulaPreset;
  if (key === "matrix" || key === "system") {
    if (typeof columns !== "number" || !Number.isInteger(columns) || columns < 1 || columns > maxGridSize) return null;
    const rows = values.length / columns;
    if (!Number.isInteger(rows) || rows < 1 || rows > maxGridSize || (key === "system" && (columns !== 1 || rows < 2))) return null;
  } else if (values.length !== fixedPresets[key].fields.length && !(key === "power" && values.length === 3)) {
    return null;
  }
  for (const value of values) {
    if (typeof value === "string") continue;
    if (!Array.isArray(value) || value.length < 3 || value.length % 2 === 0 || value.length > maxFormulaNodes * 2 + 1) return null;
    for (let i = 0; i < value.length; i++) {
      const part: unknown = value[i];
      if (i % 2 === 0) {
        if (typeof part !== "string") return null;
      } else if (!part || typeof part !== "object" || !readFields(part as Record<string, unknown>, depth + 1, budget)) {
        return null;
      }
    }
  }
  if (key === "matrix" || key === "system") return { preset: key, values, columns: columns as number };
  return { preset: key, values };
}

export function formulaSource(attrs?: Record<string, unknown>) {
  const form = readFormulaFields(attrs);
  return form ? renderFields(form) : typeof attrs?.latex === "string" ? attrs.latex : "";
}

function renderFields(form: FormulaFields) {
  const values: string[] = [];
  for (const value of form.values) {
    let expression = "";
    for (const part of formulaParts(value)) {
      if (typeof part === "string") {
        expression += part;
      } else {
        const nested = renderFields(part);
        if (!nested) return "";
        expression += "{" + nested + "}";
      }
    }
    values.push(expression.trim());
  }
  if (form.preset === "matrix" || form.preset === "system") {
    if (values.some(value => !value)) return "";
    const rows = Array.from({ length: values.length / form.columns }, (_, row) =>
      values.slice(row * form.columns, (row + 1) * form.columns).map(value => "{" + value + "}").join("&"));
    const env = form.preset === "matrix" ? "pmatrix" : "cases";
    return "\\begin{" + env + "}" + rows.join("\\\\") + "\\end{" + env + "}";
  }
  const { fields, build }: Preset = fixedPresets[form.preset];
  return fields.every((field, index) => field.optional || values[index]) ? build(values) : "";
}

export function formulaTextLength(form: FormulaFields): number {
  return form.values.reduce((total, value) => total + formulaParts(value).reduce((length, part) =>
    length + (typeof part === "string" ? part.length : formulaTextLength(part)), 0), 0);
}

function groupAt(text: string, start: number, open = "{", close = "}") {
  if (text[start] !== open) return null;
  let depth = 1;
  for (let i = start + 1; i < text.length; i++) {
    const char = text[i];
    if (char === "\\") { i++; continue; }
    if (char === open) depth++;
    if (char === close && --depth === 0) return { value: text.slice(start + 1, i), end: i + 1 };
  }
  return null;
}

function splitGrid(text: string) {
  const rows: string[][] = [[]];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\") {
      if (!depth && text[i + 1] === "\\") {
        rows.at(-1)?.push(text.slice(start, i).trim());
        rows.push([]);
        start = i + 2;
      }
      i++;
      continue;
    }
    if (text[i] === "{") depth++;
    if (text[i] === "}") depth--;
    if (!depth && text[i] === "&") {
      rows.at(-1)?.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  rows.at(-1)?.push(text.slice(start).trim());
  return rows;
}

function readLegacyOperator(latex: string): FormulaFields | null {
  const command = /^\\(sum|prod|int|lim|log|sin|cos|tan|cot)(?![a-zA-Z])/.exec(latex);
  if (!command) return null;
  const operator = command[1];
  let end = command[0].length;
  let lower = "", upper = "";
  for (let n = 0; n < 2; n++) {
    const script = latex[end];
    if (script !== "_" && script !== "^") break;
    const group = groupAt(latex, end + 1);
    if (!group) return null;
    if (script === "_") lower = group.value;
    else upper = group.value;
    end = group.end;
  }
  const tail = latex.slice(end).trim();
  if (!tail) return null;
  if (operator === "sum" || operator === "prod") {
    return { preset: operator === "sum" ? "sum" : "product", values: [tail, lower, upper] };
  }
  if (operator === "int") {
    const differential = /^(.*?)(?:\\,|\s+)d(?:\{([a-zA-Z])\}|([a-zA-Z]))$/s.exec(tail);
    return differential ? { preset: "integral", values: [differential[1], lower, upper, differential[2] ?? differential[3]] } : null;
  }
  if (operator === "lim") {
    const sides = /^([a-zA-Z])\s*(?:\\to|\\rightarrow|→)\s*(.+)$/s.exec(lower);
    return sides && !upper ? { preset: "limit", values: [tail, sides[1], sides[2]] } : null;
  }
  const argument = groupAt(tail, 0);
  const enclosed = /^\\left\(([\s\S]+)\\right\)$/.exec(tail);
  const term = enclosed?.[1] ?? (argument?.end === tail.length ? argument.value : /^[a-zA-Z0-9]+$/.test(tail) ? tail : "");
  if (!term || upper) return null;
  if (operator === "log") return { preset: "log", values: [term, lower] };
  return !lower && Object.hasOwn(trigFunctions, operator) ? { preset: operator as keyof typeof trigFunctions, values: [term] } : null;
}

// Earlier toolbar versions stored these shapes as LaTeX without their field values.
export function readLegacyFormula(latex: string): FormulaFields | null {
  if (latex.startsWith("\\frac{") || latex.startsWith("\\binom{")) {
    const fraction = latex.startsWith("\\frac{");
    const top = groupAt(latex, fraction ? 5 : 6);
    const bottom = top && groupAt(latex, top.end);
    if (top && bottom?.end === latex.length) return { preset: fraction ? "fraction" : "binomial", values: [top.value, bottom.value] };
  }
  const vector = /^\\(?:vec|overrightarrow)(?=\{)/.exec(latex);
  if (vector) {
    const term = groupAt(latex, vector[0].length);
    if (term?.end === latex.length) return { preset: "vector", values: [term.value] };
  }
  if (latex.startsWith("\\sqrt{") || latex.startsWith("\\sqrt[")) {
    const degree = groupAt(latex, 5, "[", "]");
    const value = groupAt(latex, degree?.end ?? 5);
    if (value?.end === latex.length) {
      const grouped = degree && groupAt(degree.value, 0);
      const index = grouped && grouped.end === degree?.value.length ? grouped.value : degree?.value ?? "";
      return { preset: "root", values: [value.value, index] };
    }
  }
  const grid = /^\\begin\{(pmatrix|cases)\}([\s\S]*)\\end\{\1\}$/.exec(latex);
  if (grid && !/\\(?:begin|end)\b/.test(grid[2])) {
    const rows = splitGrid(grid[2]);
    const columns = rows[0].length;
    if (rows.every(row => row.length === columns)) {
      return readFormulaFields({ preset: grid[1] === "pmatrix" ? "matrix" : "system", values: rows.flat(), columns });
    }
  }
  return readLegacyOperator(latex);
}

export function editableFormulaFields(attrs: Record<string, unknown>) {
  return readFormulaFields(attrs) ?? readLegacyFormula(typeof attrs.latex === "string" ? attrs.latex : "");
}
