import { account } from "../../../../lib/auth";
import { first } from "../../../../lib/db";
import { materialImageType } from "../../../../lib/material-image";

export async function GET() {
  const user = await account();
  if (!user) return new Response(null, { status: 404 });
  const avatar = await first<{ bytes: Uint8Array }>("SELECT bytes FROM account_avatars WHERE account=$1", [user.id]);
  const type = avatar && materialImageType(avatar.bytes);
  if (!avatar || !type) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(avatar.bytes), { headers: {
    "Content-Type": type,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
