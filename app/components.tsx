"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function Hidden({ name, value }: { name: string; value: string | number }) {
  return <input type="hidden" name={name} value={value} />;
}
export function Submit({ children, secondary = false, pendingLabel = "Сохранение…" }: { children: ReactNode; secondary?: boolean; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className={secondary ? "secondary" : ""}>{pending ? pendingLabel : children}</button>;
}
