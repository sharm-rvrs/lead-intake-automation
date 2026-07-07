import type { Metadata } from "next";
import { Inter } from "next/font/google";
// @ts-expect-error -- Next.js handles global CSS imports in the app router build pipeline
import "./globals.css";

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Bloom Studio — Let's Chat About Your Project",
  description:
    "Tell Bloom Studio about your project and we'll get back to you with a friendly, personalized reply.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} font-sans antialiased bg-white text-gray-900`}>
        {children}
      </body>
    </html>
  );
}
