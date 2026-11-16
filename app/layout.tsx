import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./theme.css";
import "./style.css";
import "./lesson.css";
import "./formula.css";
export const metadata: Metadata = {
  title: "Olimpik — олимпиадная математика",
  applicationName: "Olimpik",
  description: "Учебная платформа олимпиадной подготовки",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ru"><body>{children}</body></html>;
}
