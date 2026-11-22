import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "../../../lib/auth";
import { rows } from "../../../lib/db";
import { canReviewInquiries } from "../../../lib/inquiry-access";
import { Submit } from "../../submit";
import { CabinetFrame } from "../frame";
import { markInquiryContacted } from "./actions";
import styles from "./inquiries.module.css";

type Inquiry = {
  id: string;
  name: string;
  school_grade: "8" | "9" | "other" | null;
  phone: string | null;
  email: string | null;
  created_at: Date;
  contacted_at: Date | null;
};

const date = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Moscow",
});
const pageSize = 24;

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireAccount("methodist");
  if (!canReviewInquiries(user)) notFound();

  const requested = Number((await searchParams).page);
  const page = Number.isInteger(requested) && requested >= 1 && requested <= 1_000_000 ? requested : 1;
  const inquiries = await rows<Inquiry>(
    `SELECT id, name, school_grade, phone, email, created_at, contacted_at
     FROM school_inquiries ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`,
    [pageSize + 1, (page - 1) * pageSize],
  );

  return <CabinetFrame user={user} view="inquiries" title="Заявки с сайта">
    {!inquiries.length && <div className="panel">Заявок на этой странице пока нет.</div>}
    <div className={styles.list}>
      {inquiries.slice(0, pageSize).map(inquiry => <article key={inquiry.id} className={`panel ${styles.item}`}>
        <div>
          <h2>{inquiry.name}</h2>
          <p className="muted">
            {date.format(inquiry.created_at)} МСК
            {inquiry.school_grade && ` · ${inquiry.school_grade === "other" ? "Другой класс" : inquiry.school_grade + " класс"}`}
          </p>
          <div className={styles.contacts}>
            {inquiry.phone && <a href={"tel:" + inquiry.phone}>{inquiry.phone}</a>}
            {inquiry.email && <a href={"mailto:" + encodeURIComponent(inquiry.email).replace("%40", "@")}>{inquiry.email}</a>}
          </div>
        </div>
        {inquiry.contacted_at ? <p className={styles.contacted}>Связались · {date.format(inquiry.contacted_at)} МСК</p> :
          <form action={markInquiryContacted.bind(null, inquiry.id)}><Submit>Отметить обработанной</Submit></form>}
      </article>)}
    </div>
    {(page > 1 || inquiries.length > pageSize) && <nav className={styles.pagination} aria-label="Страницы заявок">
      {page > 1 && <Link className="button secondary" href={"/cabinet/inquiries?page=" + (page - 1)}>Назад</Link>}
      {inquiries.length > pageSize && <Link className="button secondary" href={"/cabinet/inquiries?page=" + (page + 1)}>Дальше</Link>}
    </nav>}
  </CabinetFrame>;
}
