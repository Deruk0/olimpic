import type { Metadata } from "next";
import { siteUrl } from "../lib/site-url";
import { PageScrollbar } from "./scroll-area";
import "katex/dist/katex.min.css";
import "./theme.css";
import "./style.css";
import "./lesson.css";
import "./formula.css";
import "./browser-controls.css";
export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: "Olimpik — занятия с преподавателями",
  applicationName: "Olimpik",
  description: "Каталог преподавателей и учебная платформа для индивидуальных занятий.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body id="olimpik-page">{children}<PageScrollbar /></body></html>;
}
