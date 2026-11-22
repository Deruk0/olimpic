import type { MetadataRoute } from "next";
import { teacherCards, teacherPath } from "../lib/booking";
import { siteUrl } from "../lib/site-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!siteUrl) return [];
  const teachers = await teacherCards();
  return ["/", ...teachers.map(teacher => teacherPath(teacher.id))].map(path => ({ url: new URL(path, siteUrl).href }));
}
