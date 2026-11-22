import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "../../../lib/auth";
import { first, rows } from "../../../lib/db";
import { libraryKinds, libraryLabels, libraryPath, type LibraryEntry, type LibraryTask, type TheoryOption } from "../../../lib/library";
import { workLabels } from "../../../lib/work";
import { CabinetFrame } from "../frame";
import { DeleteLibraryItem, LibraryEditor } from "../../library-editor";
import "../../library-modules.css";
import { EmptyList, ListFilters } from "../../list-filters";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ kind?: string; id?: string; saved?: string; deleted?: string; q?: string; status?: string; sort?: string }> }) {
  const user = await requireAccount("teacher");
  const query = await searchParams;
  const kind = libraryKinds.find(value => value === query.kind) ?? "theory";
  const entry = query.id && query.id !== "new" ? await first<LibraryEntry>("SELECT id,kind,title,ready,data FROM library_items WHERE kind=$1 AND id=$2 AND teacher_id=$3", [kind, query.id, user.id]) : undefined;
  if (query.id && query.id !== "new" && !entry) notFound();
  const tasks = kind === "work" && query.id ? await rows<Extract<LibraryEntry, { kind: "task" }>>("SELECT id,kind,title,ready,data FROM library_items WHERE kind='task' AND ready AND teacher_id=$1 ORDER BY title,id", [user.id]) : [];
  const entries = query.id ? [] : await rows<LibraryEntry>("SELECT id,kind,title,ready,data FROM library_items WHERE kind=$1 AND teacher_id=$2 ORDER BY updated DESC,title", [kind, user.id]);
  const theories = kind === "task" ? await rows<TheoryOption>("SELECT id,title,COALESCE(data->>'topic','') AS topic FROM library_items WHERE kind='theory' AND teacher_id=$1 ORDER BY title,id", [user.id]) : [];
  const normalize = (value: string | undefined) => (value ?? "").trim().toLocaleLowerCase("ru");
  const relatedTheories = (task: LibraryTask) => task.theoryId ? theories.filter(theory => theory.id === task.theoryId) :
    theories.filter(theory => normalize(task.topic) !== "" && normalize(theory.topic) === normalize(task.topic));
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";
  const status = ["ready", "draft"].includes(query.status ?? "") ? query.status! : "all";
  const sort = query.sort === "title" ? "title" : "updated";
  const visible = entries.filter(item =>
    (status === "all" || item.ready === (status === "ready")) &&
    (item.title + " " + ("topic" in item.data ? item.data.topic : "") + " " + (item.kind === "task" ? relatedTheories(item.data).map(theory => theory.title).join(" ") : "")).toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru"))
  );
  if (sort === "title") visible.sort((a, b) => a.title.localeCompare(b.title, "ru") || a.id.localeCompare(b.id));
  return <CabinetFrame user={user} view="library" title="Библиотека материалов" saved={query.saved}>
    {query.deleted === "1" && <p className="notice" role="status">Материал удалён из библиотеки.</p>}
    <nav className="chips" aria-label="Разделы библиотеки">{libraryKinds.map(item => <Link key={item} className={item === kind ? "active" : ""} aria-current={item === kind ? "page" : undefined} href={libraryPath(item)}>{libraryLabels[item]}</Link>)}</nav>
    {query.id ? <section className="panel">
      <p className="back-link"><Link href={libraryPath(kind)}>← К списку материалов</Link></p>
      <div className="split"><h2>{entry?.title || { theory: "Новая теория", task: "Новая задача", work: "Новая работа" }[kind]}</h2>{entry && <span className="badge">{entry.ready ? "Готово к использованию" : "Черновик"}</span>}</div>
      <LibraryEditor key={query.id + kind} kind={kind} entry={entry} tasks={tasks} theories={theories} />
      {entry && <DeleteLibraryItem key={entry.id} entry={entry} />}
    </section> : <>
      <div className="list-heading"><p className="muted">{kind === "theory" ? "Теорию можно повторно использовать в занятиях разных учеников." : kind === "task" ? "Готовые задачи доступны при сборке практики, домашней или самостоятельной работы." : "Соберите работу из задач банка и используйте её при назначении занятия."}</p>
        <Link className="button" href={libraryPath(kind, "new")}>{kind === "theory" ? "+ Создать теорию" : kind === "task" ? "+ Создать задачу" : "+ Собрать работу"}</Link></div>
      <ListFilters action="/cabinet/library" hidden={{ kind }} search={search} placeholder={kind === "task" ? "Задача, тема или теория" : "Название или тема"} reset={libraryPath(kind)} count={visible.length} filters={[
        { name: "status", label: "Готовность", value: status, options: [["all", "Все материалы"], ["ready", "Готовые"], ["draft", "Черновики"]] },
        { name: "sort", label: "Сортировка", value: sort, options: [["updated", "Недавно изменённые"], ["title", "По названию · А–Я"]] },
      ]} />
      {!visible.length && <EmptyList reset={libraryPath(kind)} />}
      {visible.map(item => {
        const related = item.kind === "task" ? relatedTheories(item.data) : [];
        return <article className="panel split list-card" key={item.id}><div>
        <h2><Link href={libraryPath(kind, item.id)}>{item.title || "Без названия"}</Link></h2>
        {(item.kind === "task" || item.kind === "theory") && <p className="muted">Тема · {item.data.topic || "Не указана"}</p>}
        {item.kind === "task" && <div className="library-theory">
          <span className="muted">{item.data.theoryId ? "Связанная теория" : "Теория по теме"} · </span>
          {related.length ? related.map(theory =>
            <Link key={theory.id} href={libraryPath("theory", theory.id)}>{theory.title || "Без названия"}</Link>
          ) : <span className="muted">{item.data.theoryId ? "Недоступна" : "Не выбрана"}</span>}
        </div>}
        {item.kind === "work" && <p>{workLabels[item.data.kind]} · задач: {item.data.tasks.length}</p>}
      </div><div className="controls"><span className={"badge" + (item.ready ? " badge-success" : " badge-neutral")}>{item.ready ? "Готово к использованию" : "Черновик"}</span>
        <Link className="button secondary" href={libraryPath(kind, item.id)} aria-label={"Редактировать " + (item.title || "материал без названия")}>Редактировать</Link></div></article>;
      })}
    </>}
  </CabinetFrame>;
}
