# AGENTS.md

Пиши кратко. Пользовательские тексты и документацию веди на русском. Файлы сохраняй в UTF-8 без BOM. В Windows PowerShell 5.1 избегай `Get-Content | Set-Content` при редактировании.

## Где работать

- `app/cabinet/` — страницы ученика, куратора и методиста. `app/actions.ts` и `app/library-actions.ts` — серверные действия.
- `app/text-editor.tsx` и `app/rich-document.tsx` — редактор Tiptap и отображение сохранённых документов.
- `lib/auth.ts` — сессии и доступ. `lib/library.ts`, `lib/work.ts`, `lib/student.ts` — библиотека, работы и данные ученика.
- `lib/schema.sql` — общая схема PostgreSQL и PGlite. `scripts/manage.mjs` — аккаунты, группы, приглашения и демоданные.

## Что сохранять при изменениях

- Проверяй роль и доступ к группе или материалу на сервере, включая маршруты выдачи вложений.
- Сохраняй совместимость с существующей базой и назначенными занятиями. Назначение хранит снимок материалов, а смена версии ограничена началом занятия и первой сдачей.
- Храни коды входа, строки подключения и данные учеников вне документации и исходников.
- Для ручных проверок используй отдельную тестовую базу. Останови сервер перед запуском CLI на том же каталоге PGlite.

## Проверка

После правок TypeScript запускай `npm run typecheck`. При изменении маршрутов, серверных действий или сборки запускай также `npm run build`. Проверяй затронутый сценарий в кабинете нужной роли. Команды запуска и сценарий показа описаны в [README.md](README.md).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
