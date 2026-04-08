"use client";

import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [showPw, setShowPw] = useState(false);

  // Forgot password state
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

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

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setResetError("");

    if (newPassword !== confirmPassword) {
      setResetError(t("passwordsDoNotMatch"));
      return;
    }
    if (newPassword.length < 8) {
      setResetError(t("passwordTooShort"));
      return;
    }

    setResetting(true);
    try {
      await api.post("/auth/reset-password", { email: resetEmail, new_password: newPassword });
      setShowReset(false);
      setSuccessMsg(t("passwordResetSuccess"));
      setResetEmail("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setResetError(err?.response?.data?.detail || t("resetFailed"));
    } finally {
      setResetting(false);
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
          {!showReset ? (
            <>
              <h2 className="mb-6 text-xl font-semibold text-gray-900">
                {t("signInToAccount")}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="animate-fade-in rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                {successMsg && (
                  <div className="animate-fade-in rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {successMsg}
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
                  <div className="relative">
                    <input
                      id="password"
                      type={showPw ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-field pe-10"
                      placeholder={t("passwordPlaceholder")}
                      dir="ltr"
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute inset-y-0 end-0 flex items-center pe-3 text-gray-400 hover:text-gray-600">
                      {showPw ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="button" onClick={() => { setShowReset(true); setError(""); setSuccessMsg(""); }}
                    className="text-xs font-medium text-[#0091DA] transition-colors hover:text-[#00338D]">
                    {t("forgotPassword")}
                  </button>
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
            </>
          ) : (
            <>
              <h2 className="mb-6 text-xl font-semibold text-gray-900">
                {t("resetPassword")}
              </h2>

              <form onSubmit={handleReset} className="space-y-4">
                {resetError && (
                  <div className="animate-fade-in rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {resetError}
                  </div>
                )}

                <div>
                  <label htmlFor="reset-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                    {t("email")}
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="input-field"
                    placeholder={t("emailPlaceholder")}
                    dir="ltr"
                  />
                </div>

                <div>
                  <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                    {t("newPassword")}
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showNewPw ? "text" : "password"}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input-field pe-10"
                      placeholder={t("newPasswordPlaceholder")}
                      dir="ltr"
                    />
                    <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute inset-y-0 end-0 flex items-center pe-3 text-gray-400 hover:text-gray-600">
                      {showNewPw ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                    {t("confirmPassword")}
                  </label>
                  <div className="relative">
                    <input
                      id="confirm-password"
                      type={showConfirmPw ? "text" : "password"}
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-field pe-10"
                      placeholder={t("confirmPasswordPlaceholder")}
                    dir="ltr"
                  />
                    <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)}
                      className="absolute inset-y-0 end-0 flex items-center pe-3 text-gray-400 hover:text-gray-600">
                      {showConfirmPw ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={resetting} className="btn-primary h-12 w-full text-base">
                  {resetting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    t("resetPassword")
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500">
                <button onClick={() => { setShowReset(false); setResetError(""); }}
                  className="font-medium text-[#0091DA] transition-colors hover:text-[#00338D]">
                  {t("backToLogin")}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
