import { account } from "../../../../../../lib/auth";
import { first } from "../../../../../../lib/db";
import { roomLesson } from "../../../../../../lib/room-data";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; image: string }> }) {
  const user = await account();
  const { id, image } = await params;
  const lesson = user && await roomLesson(id, user);
  const now = Date.now();
  if (!lesson || now < lesson.opens || now >= lesson.closes) return new Response(null, { status: 404 });
  const file = await first<{ image: Uint8Array; mime: string }>(
    "SELECT image,mime FROM room_messages WHERE lesson_id=$1 AND id=$2 AND image IS NOT NULL", [id, image]);
  if (!file) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(file.image), { headers: {
    "Content-Type": file.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"
  } });
}
