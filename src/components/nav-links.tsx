"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettings } from "@/components/settings-provider";

export function NavLinks({ openRequests = 0 }: { openRequests?: number }) {
  const pathname = usePathname();
  const { terms } = useSettings();

  const NAV_ITEMS = [
    { href: "/dashboard", label: "Übersicht" },
    { href: "/transactions", label: "Buchungen" },
    { href: "/antraege", label: terms.requestsNav },
    { href: "/receipts", label: "Belege" },
    { href: "/categories", label: "Kategorien" },
    { href: "/steuererklaerung", label: "Steuererklärung" },
  ];

  return (
    <nav className="flex items-center gap-1">
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary-600 text-white"
                : "text-ink-secondary hover:bg-primary-50 hover:text-ink"
            }`}
          >
            {item.label}
            {item.href === "/antraege" && openRequests > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  isActive ? "bg-white text-primary-700" : "bg-expense text-white"
                }`}
              >
                {openRequests}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
