import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "../../../../lib/auth";
import { formatLessonTime } from "../../../../lib/lesson-time";
import { roomIceServers, roomLesson } from "../../../../lib/room-data";
import { CabinetFrame } from "../../frame";
import { VideoRoom } from "../video-room";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccount();
  const { id } = await params;
  const lesson = await roomLesson(id, user);
  if (!lesson) notFound();
  const now = Date.now();
  const open = now >= lesson.opens && now < lesson.closes;
  return <CabinetFrame user={user} view="schedule" title={lesson.title} back={{ href: "/cabinet/schedule", label: "Расписание" }}>
    {open ? <VideoRoom id={id} teacher={user.role === "teacher"} peerName={lesson.peer_name} iceServers={roomIceServers()} /> :
      <section className="panel">
        <p>{now >= lesson.closes ? "Урок завершён." : "Комната откроется " + formatLessonTime(new Date(lesson.opens)) + "."}</p>
        <Link href="/cabinet/schedule">← К расписанию</Link>
      </section>}
  </CabinetFrame>;
}
