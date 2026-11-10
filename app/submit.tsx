"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function Submit({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? "Сохранение…" : children}</button>;
}
