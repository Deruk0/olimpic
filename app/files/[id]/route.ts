import { account } from "../../../lib/auth";
import { first } from "../../../lib/db";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await account();
  if (!user) return new Response(null, { status: 404 });
  const { id } = await params;
  const file = await first<{ filename: string; mime: string; bytes: Uint8Array }>(
    "SELECT f.filename,f.mime,f.bytes FROM attachments f JOIN assignments a ON a.id=f.assignment JOIN groups g ON g.id=a.group_id JOIN members m ON m.student=f.student AND m.group_id=g.id WHERE f.id=$1 AND (f.student=$2 OR g.curator=$2)",
    [id, user.id]);
  if (!file) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(file.bytes), { headers: {
    "Content-Type": file.mime,
    "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(file.filename).replace(/['()*]/g, c => "%" + c.charCodeAt(0).toString(16)),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff"
  } });
}
