"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { useSettings } from "@/components/settings-provider";

const TABS = [
  {
    href: "/dashboard",
    label: "Übersicht",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12l9-8 9 8M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10"
      />
    ),
  },
  {
    href: "/transactions",
    label: "Buchungen",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h16M4 12h16M4 18h10"
      />
    ),
  },
  {
    href: "/transactions/new?scan=1",
    label: "Scannen",
    highlight: true,
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.83 6l.9-1.8A1 1 0 018.62 3.6h6.76a1 1 0 01.9.55L17.17 6H20a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1h2.83zM12 17a4 4 0 100-8 4 4 0 000 8z"
      />
    ),
  },
  {
    href: "/receipts",
    label: "Belege",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6M9 8h1M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z"
      />
    ),
  },
];

export function BottomNav({ openRequests = 0 }: { openRequests?: number }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { terms } = useSettings();

  const MORE_LINKS = [
    { href: "/antraege", label: terms.requestsTitle },
    { href: "/categories", label: "Kategorien" },
    { href: "/steuererklaerung", label: "Steuererklärung" },
    { href: "/einstellungen", label: "Einstellungen" },
  ];

  const moreActive = MORE_LINKS.some((l) => pathname.startsWith(l.href));

  return (
    <>
      {moreOpen && (
        <button
          aria-label="Menü schließen"
          className="animate-fade-in fixed inset-0 z-20 bg-ink/30 md:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* bottom: Nav-Höhe (4rem) + iPhone-Safe-Area + 0.5rem Abstand —
          sonst überdeckt die Navigationsleiste den unteren Menü-Rand */}
      {moreOpen && (
        <div className="animate-sheet-in fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-3 rounded-(--radius-card) border border-line bg-surface p-2 shadow-(--shadow-card-hover) md:hidden">
          {MORE_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMoreOpen(false)}
              className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium ${
                pathname.startsWith(link.href)
                  ? "bg-primary-50 text-primary-700"
                  : "text-ink hover:bg-page"
              }`}
            >
              {link.label}
              {link.href === "/antraege" && openRequests > 0 && (
                <span className="rounded-full bg-expense px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {openRequests}
                </span>
              )}
            </Link>
          ))}
          <div className="mt-1 border-t border-line px-2 pt-2">
            <SignOutButton />
          </div>
        </div>
      )}

      <nav
        aria-label="Hauptnavigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="grid h-16 grid-cols-5">
          {TABS.map((tab) => {
            const isActive =
              tab.href === "/transactions"
                ? pathname === "/transactions" ||
                  (pathname.startsWith("/transactions/") &&
                    pathname !== "/transactions/new")
                : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

            if (tab.highlight) {
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-label="Beleg scannen"
                  className="flex items-center justify-center"
                  onClick={() => setMoreOpen(false)}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-white shadow-md">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="h-6 w-6"
                    >
                      {tab.icon}
                    </svg>
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setMoreOpen(false)}
                className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  isActive ? "text-primary-700" : "text-ink-muted"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={isActive ? 2 : 1.5}
                  className="h-5 w-5"
                >
                  {tab.icon}
                </svg>
                {tab.label}
              </Link>
            );
          })}

          <button
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              moreActive || moreOpen ? "text-primary-700" : "text-ink-muted"
            }`}
          >
            {openRequests > 0 && (
              <span className="absolute right-1/2 top-2 -mr-4 flex h-4 min-w-4 items-center justify-center rounded-full bg-expense px-1 text-[10px] font-bold leading-none text-white">
                {openRequests}
              </span>
            )}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={moreActive || moreOpen ? 2 : 1.5}
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12h.01M12 12h.01M18 12h.01"
              />
            </svg>
            Mehr
          </button>
        </div>
      </nav>
    </>
  );
}
