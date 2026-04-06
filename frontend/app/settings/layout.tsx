"use client";

import { ProtectedRoute } from "@/components/ui/protected-route";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/settings/llm", labelKey: "llmConfiguration", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { href: "/settings/prompts", labelKey: "promptManagement", icon: "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { href: "/settings/templates", labelKey: "slideTemplates", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
  { href: "/settings/brand-profiles", labelKey: "brandProfiles", icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" },
  { href: "/settings/guide-editor", labelKey: "guide", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();

  return (
    <ProtectedRoute>
      <div className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/80 backdrop-blur-lg">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#00338D] to-[#0055B8] shadow-sm">
                  <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
                </div>
                <span className="text-lg font-bold tracking-tight text-gray-900">Slides Generator</span>
              </Link>
              <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" /></svg>
              <span className="text-sm font-medium text-gray-500">{t("settings")}</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Guide link */}
              <Link href="/guide" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                {t("guide")}
              </Link>
              {/* Language toggle */}
              <button onClick={() => setLanguage(language === "en" ? "ar" : "en")}
                className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors">
                {language === "en" ? "عربي" : "EN"}
              </button>
              <span className="text-sm text-gray-600">{user?.name}</span>
              <button onClick={() => { logout(); router.push("/login"); }} className="btn-ghost text-sm">{t("logout")}</button>
            </div>
          </div>
        </header>

        <div className="mx-auto flex max-w-7xl gap-8 px-6 py-8">
          <aside className="w-56 shrink-0">
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    pathname === item.href ? "bg-[#00338D]/10 text-[#00338D]" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
                  {t(item.labelKey)}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="min-w-0 flex-1 animate-fade-in">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
