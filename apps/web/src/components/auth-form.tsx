"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Building2, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const supabase = createClient();

    if (mode === "register") {
      const fullName = String(form.get("fullName"));
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName, role: "agent" } }
      });
      if (error) setError(error.message);
      else if (data.session) router.push("/dashboard");
      else setMessage("Pendaftaran berhasil. Silakan cek email untuk verifikasi akun sebelum masuk.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push(params.get("next") || "/dashboard");
    }
    setLoading(false);
    router.refresh();
  }

  return <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl shadow-emerald-900/5 sm:p-9">
    <Link href="/" className="flex items-center gap-2 text-xl font-black text-[#087a55]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#087a55] text-white"><Building2/></span>ezyproperty</Link>
    <h1 className="mt-8 text-2xl font-black text-slate-900">{mode === "login" ? "Selamat datang kembali" : "Daftar sebagai agen"}</h1>
    <p className="mt-2 text-sm text-slate-500">{mode === "login" ? "Masuk untuk mengelola akun dan listing properti." : "Buat akun agen untuk mulai mengelola listing properti."}</p>
    <form onSubmit={submit} className="mt-7 space-y-4">
      {mode === "register" && <label className="block text-sm font-semibold text-slate-700">Nama lengkap<input name="fullName" required minLength={2} autoComplete="name" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#087a55]"/></label>}
      <label className="block text-sm font-semibold text-slate-700">Email<input name="email" type="email" required autoComplete="email" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#087a55]"/></label>
      <label className="block text-sm font-semibold text-slate-700">Password<input name="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#087a55]"/><span className="mt-1 block text-xs font-normal text-slate-400">Minimal 8 karakter.</span></label>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#087a55] px-5 py-3.5 font-bold text-white hover:bg-[#075b42] disabled:opacity-60">{loading && <LoaderCircle className="animate-spin" size={18}/ >}{mode === "login" ? "Masuk" : "Buat akun agen"}</button>
    </form>
    <p className="mt-6 text-center text-sm text-slate-500">{mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"} <Link className="font-bold text-[#087a55]" href={mode === "login" ? "/register" : "/login"}>{mode === "login" ? "Daftar agen" : "Masuk"}</Link></p>
    <Link href="/" className="mt-5 block text-center text-xs text-slate-400 hover:text-[#087a55]">← Kembali ke beranda</Link>
  </div>;
}
