import Link from "next/link";
import { requireAccount } from "../../../lib/auth";
import { bookingRequests, bookingStatuses, teacherPath } from "../../../lib/booking";
import { formatLessonTime } from "../../../lib/lesson-time";
import { decideBooking } from "../../booking-actions";
import { CabinetFrame } from "../frame";

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const user = await requireAccount();
  const teacher = user.role === "teacher";
  const [query, requests] = await Promise.all([searchParams, bookingRequests(user.id, user.role)]);
  const now = Date.now();
  return <CabinetFrame user={user} view="bookings" title={teacher ? "Заявки на занятия" : "Мои заявки"} saved={query.saved} error={query.error}>
    {!teacher && <p><Link href="/">← К каталогу преподавателей</Link></p>}
    {requests.length === 0 && <p className="panel muted">{teacher ? "Входящих заявок пока нет." : "Вы ещё не отправляли заявки."}</p>}
    {requests.map(request => {
      const starts = new Date(request.starts);
      const expired = request.status === "pending" && starts.getTime() <= now;
      return <article className="panel list-card" key={request.id}>
        <div className="split">
          <h2>{teacher ? request.name : <Link href={teacherPath(request.teacher_id)}>{request.name}</Link>}</h2>
          <span className={"badge" + (request.status === "confirmed" ? " badge-success" : expired || request.status === "declined" ? " badge-neutral" : "")}>
            {expired ? "Время прошло" : bookingStatuses[request.status]}
          </span>
        </div>
        <p><time dateTime={starts.toISOString()}>{formatLessonTime(starts)}</time> · 60 мин</p>
        {request.comment && <p className="pre">{request.comment}</p>}
        {teacher && request.status === "pending" && <form action={decideBooking.bind(null, request.id)} className="controls">
          {!expired && <button name="decision" value="confirmed">Подтвердить</button>}
          <button className="secondary" name="decision" value="declined">Отклонить</button>
        </form>}
      </article>;
    })}
  </CabinetFrame>;
}
