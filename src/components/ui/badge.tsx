import type { CategoryType } from "@/lib/types";

export function TypeBadge({ type }: { type: CategoryType }) {
  const isIncome = type === "income";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        isIncome ? "bg-income-bg text-income-text" : "bg-expense-bg text-expense-text"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isIncome ? "bg-income" : "bg-expense"}`}
      />
      {isIncome ? "Einnahme" : "Ausgabe"}
    </span>
  );
}
