import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  return siteUrl ? [{ url: new URL("/", siteUrl).href }] : [];
}
