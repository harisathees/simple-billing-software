import type { Metadata } from "next";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = { title: "Sign in — Billing" };

// Logged-in users are redirected to "/" by src/proxy.ts. There is no sign-up page:
// accounts are created by the owner with `npm run user:add`.
export default function LoginPage() {
  return <LoginForm />;
}
