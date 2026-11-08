import { Geist, Geist_Mono } from "next/font/google";

// Shared by app/layout.tsx and .storybook/preview.ts so stories render with the same fonts
export const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
