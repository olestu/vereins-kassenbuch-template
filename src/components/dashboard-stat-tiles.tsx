import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/count-up";

export function DashboardStatTiles({
  incomeCents,
  expenseCents,
  balanceLabel = "Saldo",
}: {
  incomeCents: number;
  expenseCents: number;
  balanceLabel?: string;
}) {
  const balanceCents = incomeCents - expenseCents;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Tile label="Einnahmen" cents={incomeCents} prefix="+ " dot="bg-income" />
      <Tile label="Ausgaben" cents={expenseCents} prefix="− " dot="bg-expense" />
      <Tile
        label={balanceLabel}
        cents={Math.abs(balanceCents)}
        prefix={balanceCents > 0 ? "+ " : balanceCents < 0 ? "− " : ""}
        dot={balanceCents >= 0 ? "bg-income" : "bg-expense"}
        valueClass={balanceCents >= 0 ? "text-income-text" : "text-expense-text"}
      />
    </div>
  );
}

function Tile({
  label,
  cents,
  prefix,
  dot,
  valueClass = "text-ink",
}: {
  label: string;
  cents: number;
  prefix: string;
  dot: string;
  valueClass?: string;
}) {
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="text-sm font-medium text-ink-secondary">{label}</span>
      </div>
      <p className={`text-2xl font-semibold tabular-nums ${valueClass}`}>
        <CountUp cents={cents} prefix={prefix} />
      </p>
    </Card>
  );
}
