"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireAccount } from "../../../lib/auth";
import { rows } from "../../../lib/db";
import { canReviewInquiries } from "../../../lib/inquiry-access";

export async function markInquiryContacted(id: string) {
  const user = await requireAccount("methodist");
  if (!canReviewInquiries(user)) notFound();
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return;
  await rows("UPDATE school_inquiries SET contacted_at=now() WHERE id=$1 AND contacted_at IS NULL", [id]);
  revalidatePath("/cabinet/inquiries");
}
