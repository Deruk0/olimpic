import { randomUUID } from "node:crypto";
import { account } from "../../lib/auth";
import { rows } from "../../lib/db";
import { materialImageType } from "../../lib/material-image";

export async function POST(request: Request) {
  const user = await account();
  if (request.headers.get("sec-fetch-site") === "cross-site" || user?.role !== "teacher") return new Response(null, { status: 403 });
  if (Number(request.headers.get("content-length")) > 4_100_000) return new Response(null, { status: 413 });
  const file = (await request.formData().catch(() => null))?.get("file");
  if (!(file instanceof File) || file.size < 1 || file.size > 4_000_000) return new Response(null, { status: 400 });
  const id = randomUUID();
  const bytes = Buffer.from(await file.arrayBuffer());
  await rows("INSERT INTO material_files(id,teacher_id,filename,bytes) VALUES ($1,$2,$3,$4)", [id, user.id, file.name.slice(0, 160), bytes]);
  return Response.json({ path: "/material-files/" + id, image: !!materialImageType(bytes) });
}
