import { redirect } from "next/navigation";
import { requireAccount } from "../../lib/auth";

type CabinetQuery = { view?: string; work?: string; saved?: string; error?: string };

export default async function Cabinet({ searchParams }: { searchParams: Promise<CabinetQuery> }) {
  const user = await requireAccount();
  const query = await searchParams;
  if (user.role === "student") {
    if (query.view === "homework" || query.view === "course") redirect("/cabinet/" + query.view);
    const params = new URLSearchParams();
    if (typeof query.saved === "string") params.set("saved", query.saved);
    if (typeof query.error === "string") params.set("error", query.error);
    const focus = query.work && /^[\w-]{1,60}$/.test(query.work) ? query.work : "";
    if (focus) params.set("focus", focus);
    const path = query.view === "plan" ? "/cabinet/plan" : "/cabinet/schedule";
    redirect(path + (params.size ? "?" + params : "") + (focus && query.view !== "plan" ? "#lesson-" + focus : ""));
  }
  const { renderCabinet } = await import("./view");
  return renderCabinet(query);
}
