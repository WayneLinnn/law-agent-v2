import type { Metadata } from "next";

import { CaseShift } from "@/components/case-shift";
import "./globals.css";

export const metadata: Metadata = {
  title: "办案",
  description: "一件案子一条记录",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-background font-sans text-foreground">
        <CaseShift>{children}</CaseShift>
      </body>
    </html>
  );
}
