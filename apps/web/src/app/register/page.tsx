import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Daftar Agen" };
export default function RegisterPage() {
  return <main className="grid min-h-screen place-items-center bg-[#edf7f1] px-4 py-10"><AuthForm mode="register"/></main>;
}
