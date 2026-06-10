import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { getActivePlanId, PLANS } from "@/lib/activePlan";

export const metadata: Metadata = {
  title: "Maraminder",
  description: "Amsterdam Marathon training plan tracker",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon.svg",          type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "mask-icon", url: "/icon.svg", color: "#6366f1" },
    ],
  },
  other: {
    "msapplication-TileImage": "/mstile-150x150.png",
    "msapplication-TileColor": "#6366f1",
    "theme-color": "#6366f1",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const currentPlanId = await getActivePlanId();

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col" style={{ background: "var(--background)", color: "var(--text)" }} suppressHydrationWarning>
        <Nav currentPlanId={currentPlanId} plans={[...PLANS]} />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
