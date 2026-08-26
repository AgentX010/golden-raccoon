import { AppShell } from "@/components/AppShell";
import { DashboardClient } from "@/components/DashboardClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard - Portfolio & Stress Testing",
  description: "View your portfolio, run agent analysis, and perform stress testing.",
};

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardClient />
    </AppShell>
  );
}
