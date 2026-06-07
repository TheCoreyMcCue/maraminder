import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Maraminder — Amsterdam Sub-3",
  description: "Marathon training plan tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col" style={{ background: "var(--background)", color: "var(--text)" }}>
        <Nav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
