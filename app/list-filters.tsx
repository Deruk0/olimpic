import Link from "next/link";
import { InterfaceIcon } from "./interface-icons";

type Filter = {
  name: string;
  label: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
};

export function ListFilters({ action, search, placeholder, filters, hidden = {}, reset, count }: {
  action: string;
  search: string;
  placeholder: string;
  filters: Filter[];
  hidden?: Record<string, string>;
  reset: string;
  count: number;
}) {
  return <section className="list-toolbar" aria-label="Поиск и фильтры">
    <form action={action} method="get" className="list-filters" key={JSON.stringify([search, filters, hidden])}>
      {Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <label className="list-search">Поиск
        <span><InterfaceIcon name="search" /><input type="search" name="q" defaultValue={search} placeholder={placeholder} maxLength={120} /></span>
      </label>
      {filters.map(filter => <label key={filter.name}>{filter.label}
        <select name={filter.name} defaultValue={filter.value}>
          {filter.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>)}
      <button type="submit">Показать</button>
    </form>
    <div className="list-results"><span role="status">Найдено · {count}</span><Link href={reset}>Сбросить фильтры</Link></div>
  </section>;
}

export function EmptyList({ reset }: { reset: string }) {
  return <div className="panel empty-list">
    <InterfaceIcon name="search" />
    <h2>Ничего не найдено</h2>
    <p className="muted">Попробуйте другой запрос или сбросьте фильтры.</p>
    <Link className="button secondary" href={reset}>Показать всё</Link>
  </div>;
}
