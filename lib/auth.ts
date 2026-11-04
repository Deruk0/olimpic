import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { first } from "./db";
import type { Account, Role } from "./model";

export const cookieName = "olimpik_session";
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("base64url");
export async function account() {
  const key = (await cookies()).get(cookieName)?.value;
  if (!key) return undefined;
  return first<Account>("SELECT a.* FROM sessions s JOIN accounts a ON a.id=s.account WHERE s.hash=$1 AND s.expires>now()", [hash(key)]);
}
export async function requireAccount(role?: Role) {
  const user = await account();
  if (!user || (role && user.role !== role)) redirect("/");
  return user;
}
