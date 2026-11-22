"use client";

import { useState } from "react";

export function CabinetFeedback({ error }: { error?: string }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return <div className={"cabinet-feedback notice" + (error ? " error" : "")}>
    <span role={error ? "alert" : "status"}>{error || "Изменения сохранены."}</span>
    <button className="secondary" type="button" onClick={() => setVisible(false)} aria-label="Закрыть уведомление">×</button>
  </div>;
}
