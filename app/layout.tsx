import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HAMS WORKS | 사내 ERP",
  description: "직원과 프리랜서, 근태와 원격근무를 한곳에서 관리하는 HAMS ERP",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
