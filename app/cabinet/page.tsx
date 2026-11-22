import { redirect } from "next/navigation";
import { requireAccount } from "../../lib/auth";

export default async function Cabinet() {
  await requireAccount();
  redirect("/cabinet/schedule");
}
