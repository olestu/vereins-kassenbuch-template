"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { voidTransaction } from "@/lib/actions/transactions";
import { Button } from "@/components/ui/button";

const CONFIRM_TEXT =
  "Diese Buchung stornieren? Sie bleibt sichtbar (mit Beleg), zählt aber in keiner Auswertung mehr mit. Das lässt sich nicht rückgängig machen.";

export function DeleteTransactionButton({
  id,
  variant = "full",
}: {
  id: string;
  variant?: "full" | "compact" | "icon";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function handleVoid() {
    if (!confirm(CONFIRM_TEXT)) return;
    startTransition(async () => {
      try {
        await voidTransaction(id);
        toast.success("Buchung storniert");
        if (pathname !== "/transactions") {
          router.push("/transactions");
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler beim Stornieren");
      }
    });
  }

  if (variant === "icon") {
    return (
      <button
        onClick={handleVoid}
        disabled={isPending}
        title="Buchung stornieren"
        aria-label="Buchung stornieren"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-expense-bg hover:text-expense-text disabled:opacity-50"
      >
        {isPending ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-expense/30 border-t-expense" />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            className="h-4.5 w-4.5"
          >
            {/* Durchgestrichener Kreis = Storno */}
            <circle cx="12" cy="12" r="8" />
            <path strokeLinecap="round" d="M6.5 6.5l11 11" />
          </svg>
        )}
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        onClick={handleVoid}
        disabled={isPending}
        title="Buchung stornieren"
        className="text-xs font-medium text-expense-text hover:underline disabled:opacity-50"
      >
        {isPending ? "…" : "Stornieren"}
      </button>
    );
  }

  return (
    <Button variant="danger" size="sm" onClick={handleVoid} disabled={isPending}>
      {isPending ? "Stornieren…" : "Buchung stornieren"}
    </Button>
  );
}
