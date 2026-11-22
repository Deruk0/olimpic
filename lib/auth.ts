import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { first } from "./db";
import type { Account, Role } from "./model";
import { demoLoginEnabled } from "./demo-access";
import type { ThemeMode, ThemePalette } from "./theme";

export type SessionAccount = Account & {
  avatar_version: string | null;
  theme: ThemeMode;
  theme_palette: ThemePalette;
  demo_session: boolean;
};

export const cookieName = "olimpik_session";
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("base64url");
export async function account() {
  const key = (await cookies()).get(cookieName)?.value;
  if (!key) return undefined;
  return first<SessionAccount>(
    "SELECT a.*,v.version AS avatar_version,s.demo AS demo_session FROM sessions s JOIN accounts a ON a.id=s.account LEFT JOIN student_avatars v ON v.account=a.id WHERE s.hash=$1 AND s.expires>now() AND (NOT s.demo OR $2)",
    [hash(key), demoLoginEnabled()]
  );
}
export async function requireAccount(role?: Role) {
  const user = await account();
  if (!user) redirect("/login");
  if (role && user.role !== role) redirect("/cabinet");
  return user;
}
