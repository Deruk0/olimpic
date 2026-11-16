import { account } from "../../../../lib/auth";
import { first } from "../../../../lib/db";
import { materialImageType } from "../../../../lib/material-image";

export async function GET(request: Request) {
  const user = await account();
  const version = new URL(request.url).searchParams.get("v");
  if (user?.role !== "student" || !version) return new Response(null, { status: 404 });

  const row = await first<{ image: Uint8Array }>(
    "SELECT image FROM student_goal_profiles WHERE student=$1 AND image_version=$2", [user.id, version]
  );
  const type = row && materialImageType(row.image);
  if (!row || !type) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(row.image), { headers: {
    "Content-Type": type,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
