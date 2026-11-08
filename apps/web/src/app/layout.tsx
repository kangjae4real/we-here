import type { Metadata } from "next";
import { geistMono, geistSans } from "./fonts";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "we-here",
  description:
    "두 사람의 사진 위치로, 만나기 전 스쳤을지도 모르는 순간을 찾아요",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
