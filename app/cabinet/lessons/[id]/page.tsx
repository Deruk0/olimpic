import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "../../../../lib/auth";
import { studentAssignment } from "../../../../lib/student";
import { LessonMaterials } from "../../../lesson-card";
import { CabinetFrame } from "../../frame";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccount("student");
  const { id } = await params;
  const assignment = await studentAssignment(user.id, id);
  if (!assignment) notFound();
  return <CabinetFrame user={user} view="schedule" title={assignment.content.title}>
    <p><Link href={"/cabinet/schedule?focus=" + encodeURIComponent(id) + "#lesson-" + encodeURIComponent(id)}>← К расписанию</Link></p>
    <LessonMaterials assignment={assignment} />
  </CabinetFrame>;
}
