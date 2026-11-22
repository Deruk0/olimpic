import type { Metadata } from "next";
import { siteUrl } from "../lib/site-url";
import "katex/dist/katex.min.css";
import "./theme.css";
import "./style.css";
import "./lesson.css";
import "./formula.css";
export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: "Olimpik — занятия с преподавателями",
  applicationName: "Olimpik",
  description: "Каталог преподавателей и учебная платформа для индивидуальных занятий.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body>{children}</body></html>;
}
