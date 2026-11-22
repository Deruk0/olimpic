import { account } from "../../../lib/auth";
import { first } from "../../../lib/db";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await account();
  if (!user) return new Response(null, { status: 404 });
  const { id } = await params;
  const file = await first<{ filename: string; mime: string; bytes: Uint8Array }>(
    "SELECT f.filename,f.mime,f.bytes FROM attachments f JOIN assignments a ON a.id=f.assignment WHERE f.id=$1 AND (f.student=$2 OR a.teacher_id=$2)",
    [id, user.id]);
  if (!file) return new Response(null, { status: 404 });
  const inline = new URL(request.url).searchParams.get("preview") === "1" && ["image/jpeg", "image/png", "application/pdf"].includes(file.mime);
  return new Response(new Uint8Array(file.bytes), { headers: {
    "Content-Type": file.mime,
    "Content-Disposition": (inline ? "inline" : "attachment") + "; filename*=UTF-8''" + encodeURIComponent(file.filename).replace(/['()*]/g, c => "%" + c.charCodeAt(0).toString(16)),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff"
  } });
}
