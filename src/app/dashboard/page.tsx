import type { Metadata } from "next";
import Dashboard from "@/components/Dashboard";

export const metadata: Metadata = { title: "Dashboard — Billing" };

// Login-protected by src/proxy.ts (and /api/dashboard checks the login itself).
export default function DashboardPage() {
  return <Dashboard />;
}
