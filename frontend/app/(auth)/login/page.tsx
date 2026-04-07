"use client";

import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.detail || t("invalidCredentials"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Wordmark */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#00338D]">
            {t("slidesGenerator")}
          </h1>
          <p className="mt-1.5 text-sm font-medium text-gray-400">{t("byKPMG")}</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">
            {t("signInToAccount")}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="animate-fade-in rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                {t("email")}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder={t("emailPlaceholder")}
                dir="ltr"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                {t("password")}
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder={t("passwordPlaceholder")}
                dir="ltr"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary h-12 w-full text-base">
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                t("signIn")
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            {t("dontHaveAccount")}{" "}
            <Link href="/register" className="font-medium text-[#0091DA] transition-colors hover:text-[#00338D]">
              {t("createAccount")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
