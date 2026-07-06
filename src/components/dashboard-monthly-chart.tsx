"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { centsToEuroString } from "@/lib/money";

export interface MonthlyDatum {
  month: string;
  Einnahmen: number;
  Ausgaben: number;
}

export function DashboardMonthlyChart({
  data,
  title = "Einnahmen & Ausgaben pro Monat",
}: {
  data: MonthlyDatum[];
  title?: string;
}) {
  const hasData = data.some((d) => d.Einnahmen > 0 || d.Ausgaben > 0);

  return (
    <div className="rounded-(--radius-card) border border-line bg-surface p-5 shadow-(--shadow-card)">
      <h2 className="mb-4 text-sm font-semibold text-ink">{title}</h2>
      {!hasData ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-ink-muted">
            Noch keine Buchungen in diesem Jahr — das Diagramm füllt sich mit der ersten
            Buchung.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} barGap={2} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e3e7ef" />
            <XAxis
              dataKey="month"
              tick={{ fill: "#7b8397", fontSize: 12 }}
              axisLine={{ stroke: "#c9cfdb" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#7b8397", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${Math.round(v / 100)} €`}
              width={56}
            />
            <Tooltip
              formatter={(value) => `${centsToEuroString(Number(value))} €`}
              contentStyle={{ fontSize: 13, borderRadius: 8, borderColor: "#e3e7ef" }}
              cursor={{ fill: "rgba(42, 95, 196, 0.06)" }}
            />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Bar
              dataKey="Einnahmen"
              fill="#1baf7a"
              radius={[3, 3, 0, 0]}
              maxBarSize={22}
              animationDuration={600}
            />
            <Bar
              dataKey="Ausgaben"
              fill="#e34948"
              radius={[3, 3, 0, 0]}
              maxBarSize={22}
              animationDuration={600}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
