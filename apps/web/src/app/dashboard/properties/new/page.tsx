import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewPropertyForm } from "@/components/new-property-form";

export const metadata = { title: "Tambah Listing" };
export default async function NewPropertyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <main className="min-h-screen bg-[#f7faf8] px-4 py-10"><div className="mx-auto max-w-3xl"><Link href="/dashboard" className="text-sm font-semibold text-[#087a55]">← Dashboard</Link><h1 className="mt-4 text-3xl font-black">Tambah properti</h1><p className="mt-2 text-sm text-slate-500">Listing baru akan masuk ke antrean moderasi.</p><div className="mt-7 rounded-2xl bg-white p-6 shadow-sm"><NewPropertyForm/></div></div></main>;
}
