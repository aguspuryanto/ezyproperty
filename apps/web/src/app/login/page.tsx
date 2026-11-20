import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Masuk" };
export default function LoginPage() {
  return <main className="grid min-h-screen place-items-center bg-[#edf7f1] px-4 py-10"><Suspense><AuthForm mode="login"/></Suspense></main>;
}
