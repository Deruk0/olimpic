"use client";

import { startTransition, useActionState } from "react";
import { themeModes, themePalettes, type ThemeChange, type ThemeMode, type ThemePalette } from "../../../lib/theme";
import { useCabinetTheme } from "../shell";
import { saveProfileTheme } from "./actions";

type SaveResult = { error: string | null } | null;

async function saveChange(_previous: SaveResult, change: ThemeChange): Promise<SaveResult> {
  try {
    return "mode" in change ? await saveProfileTheme("mode", change.mode) : await saveProfileTheme("palette", change.palette);
  } catch {
    return { error: "Не удалось сохранить тему. Попробуйте ещё раз." };
  }
}

export function ThemeSettings() {
  const { theme, previewTheme } = useCabinetTheme();
  const [result, save, pending] = useActionState(saveChange, null);

  function selectTheme(change: ThemeChange) {
    startTransition(() => {
      previewTheme(change);
      save(change);
    });
  }

  return <section className="panel profile-theme" id="appearance">
    <h2>Оформление</h2>
    <div className="theme-controls">
      <fieldset className="theme-options theme-mode-options">
        <legend>Режим</legend>
        {(Object.keys(themeModes) as ThemeMode[]).map(mode => <label key={mode} className="theme-option">
          <span className="theme-preview" data-mode={mode} aria-hidden="true"><span /></span>
          <span className="theme-option-label">
            <input type="radio" name="theme-mode" value={mode} checked={theme.mode === mode} onChange={() => selectTheme({ mode })} />
            {themeModes[mode]}
          </span>
        </label>)}
      </fieldset>
      <fieldset className="theme-options theme-palette-options">
        <legend>Цветовая тема</legend>
        {(Object.keys(themePalettes) as ThemePalette[]).map(palette => <label key={palette} className="theme-option">
          <span className="theme-preview" data-palette={palette} aria-hidden="true"><span /></span>
          <span className="theme-option-label">
            <input type="radio" name="theme-palette" value={palette} checked={theme.palette === palette} onChange={() => selectTheme({ palette })} />
            {themePalettes[palette]}
          </span>
        </label>)}
      </fieldset>
    </div>
    <p className="theme-save-status" data-error={!pending && !!result?.error} role="status">
      {pending ? "Сохраняем тему…" : result && (result.error ?? "Тема сохранена.")}
    </p>
  </section>;
}
