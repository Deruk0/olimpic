import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "../../../../lib/auth";
import { studentAssignment } from "../../../../lib/student";
import { LessonMaterials } from "../../../lesson-card";
import { CabinetFrame } from "../../frame";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccount("student");
  const assignment = await studentAssignment(user.id, (await params).id);
  if (!assignment) notFound();
  return <CabinetFrame user={user} view="learn" title={assignment.content.title}>
    <p><Link href="/cabinet?view=learn">← К расписанию</Link></p>
    <LessonMaterials assignment={assignment} />
  </CabinetFrame>;
}
