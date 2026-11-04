import { account } from "../../../lib/auth";
import { first, rows } from "../../../lib/db";
import type { Lesson } from "../../../lib/model";
import { materialImageType } from "../../../lib/material-image";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await account();
  const { id } = await params;
  if (!user || !/^[a-f0-9-]{36}$/.test(id)) return new Response(null, { status: 404 });
  if (user.role !== "methodist") {
    const path = "/material-files/" + id;
    const lessons = await rows<{ content: Lesson }>(
      "SELECT a.content FROM assignments a JOIN groups g ON g.id=a.group_id WHERE strpos(a.content::text,$2)>0 AND (g.curator=$1 OR EXISTS(SELECT 1 FROM members m WHERE m.group_id=g.id AND m.student=$1))", [user.id,path]);
    const linked = lessons.some(({ content }) => {
      const publicText = [content.theory, ...(content.materials ?? []).map(m => m.value), ...Object.values(content.work ?? {}).map(w => w.instructions),
        ...content.tasks.flatMap(t => [t.prompt, t.hint, t.solution, ...(user.role === "curator" ? [t.rubric,t.modelAnswer] : [])])];
      return publicText.some(text => text?.includes("](" + path + ")") || text?.includes('"href":"' + path + '"') || text?.includes('"src":"' + path + '"'));
    });
    if (!linked) return new Response(null, { status: 404 });
  }
  const file = await first<{ filename: string; bytes: Uint8Array }>("SELECT filename,bytes FROM material_files WHERE id=$1",[id]);
  if (!file) return new Response(null, { status: 404 });
  const image = materialImageType(file.bytes);
  return new Response(new Uint8Array(file.bytes), {headers:{
    "Content-Type":image ?? "application/octet-stream",
    "Content-Disposition":(image ? "inline" : "attachment") + "; filename*=UTF-8''" + encodeURIComponent(file.filename).replace(/['()*]/g,c=>"%" + c.charCodeAt(0).toString(16)),
    "X-Content-Type-Options":"nosniff",
    "Cache-Control":"private, no-store"
  }});
}
