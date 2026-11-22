import { account } from "../../../lib/auth";
import { first, rows } from "../../../lib/db";
import type { Lesson } from "../../../lib/model";
import { materialImageType } from "../../../lib/material-image";
import { workKind } from "../../../lib/work";
import { referencesMaterial } from "../../rich-document";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await account();
  const { id } = await params;
  if (!user || !/^[a-f0-9-]{36}$/.test(id)) return new Response(null, { status: 404 });
  if (user.role === "student") {
    const path = "/material-files/" + id;
    const lessons = await rows<{ content: Lesson }>(
      "SELECT a.content FROM assignments a JOIN material_files f ON f.id=$2 AND f.teacher_id=a.teacher_id WHERE a.student_id=$1 AND strpos(a.content::text,$2)>0", [user.id,id]);
    const linked = lessons.some(({ content }) => {
      const studentText = [content.theory, ...(content.materials ?? []).map(m => m.value), ...Object.values(content.work ?? {}).map(w => w.instructions),
        ...content.tasks.flatMap(t => [t.prompt, ...(t.options ?? []),
          ...(workKind(t) === "practice" ? [t.hint, t.solution] : [])])];
      return studentText.some(text => referencesMaterial(text, path));
    });
    if (!linked) return new Response(null, { status: 404 });
  }
  const file = await first<{ filename: string; bytes: Uint8Array }>(
    "SELECT filename,bytes FROM material_files WHERE id=$1 AND ($2::text IS NULL OR teacher_id=$2)",
    [id, user.role === "teacher" ? user.id : null]);
  if (!file) return new Response(null, { status: 404 });
  const image = materialImageType(file.bytes);
  return new Response(new Uint8Array(file.bytes), {headers:{
    "Content-Type":image ?? "application/octet-stream",
    "Content-Disposition":(image ? "inline" : "attachment") + "; filename*=UTF-8''" + encodeURIComponent(file.filename).replace(/['()*]/g,c=>"%" + c.charCodeAt(0).toString(16)),
    "X-Content-Type-Options":"nosniff",
    "Cache-Control":"private, no-store"
  }});
}
