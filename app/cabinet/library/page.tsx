import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "../../../lib/auth";
import { first, rows } from "../../../lib/db";
import { libraryKinds, libraryLabels, libraryPath, type LibraryEntry } from "../../../lib/library";
import { workLabels } from "../../../lib/work";
import { CabinetFrame } from "../frame";
import { LibraryEditor } from "../../library-editor";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ kind?: string; id?: string; saved?: string }> }) {
  const user = await requireAccount("methodist");
  const query = await searchParams;
  const kind = libraryKinds.find(value => value === query.kind) ?? "theory";
  const entry = query.id && query.id !== "new" ? await first<LibraryEntry>("SELECT id,kind,title,ready,data FROM library_items WHERE kind=$1 AND id=$2", [kind, query.id]) : undefined;
  if (query.id && query.id !== "new" && !entry) notFound();
  const tasks = kind === "work" && query.id ? await rows<Extract<LibraryEntry, { kind: "task" }>>("SELECT id,kind,title,ready,data FROM library_items WHERE kind='task' AND ready ORDER BY title,id") : [];
  const entries = query.id ? [] : await rows<LibraryEntry>("SELECT id,kind,title,ready,data FROM library_items WHERE kind=$1 ORDER BY updated DESC,title", [kind]);
  return <CabinetFrame user={user} view="library" title="Библиотека материалов" saved={query.saved}>
    <nav className="chips" aria-label="Разделы библиотеки">{libraryKinds.map(item => <Link key={item} className={item === kind ? "active" : ""} href={libraryPath(item)}>{libraryLabels[item]}</Link>)}</nav>
    {query.id ? <section className="panel">
      <p><Link href={libraryPath(kind)}>← К списку</Link></p>
      <div className="split"><h2>{entry?.title || "Новый материал"}</h2>{entry && <span className="badge">{entry.ready ? "Готово к использованию" : "Черновик"}</span>}</div>
      <LibraryEditor key={query.id + kind} kind={kind} entry={entry} tasks={tasks} />
    </section> : <>
      <p className="muted">{kind === "theory" ? "Теорию можно повторно использовать в занятиях разных групп." : kind === "task" ? "Готовые задачи доступны при сборке практики, домашней или самостоятельной работы." : "Соберите работу из задач банка и используйте её при назначении занятия."}</p>
      <p><Link className="button" href={libraryPath(kind, "new")}>{kind === "theory" ? "+ Создать теорию" : kind === "task" ? "+ Создать задачу" : "+ Собрать работу"}</Link></p>
      {!entries.length && <p className="panel muted">В этом разделе пока пусто.</p>}
      {entries.map(item => <article className="panel split" key={item.id}><div>
        <h2><Link href={libraryPath(kind, item.id)}>{item.title || "Без названия"}</Link></h2>
        {item.kind === "work" && <p>{workLabels[item.data.kind]} · задач: {item.data.tasks.length}</p>}
      </div><span className="badge">{item.ready ? "Готово к использованию" : "Черновик"}</span></article>)}
    </>}
  </CabinetFrame>;
}
