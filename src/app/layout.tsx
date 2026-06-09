import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { getActivePlanId, PLANS } from "@/lib/activePlan";

export const metadata: Metadata = {
  title: "Maraminder",
  description: "Marathon training plan tracker",
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
