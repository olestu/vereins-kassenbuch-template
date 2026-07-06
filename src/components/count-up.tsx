"use client";

import { useEffect, useRef, useState } from "react";
import { centsToEuroString } from "@/lib/money";

/**
 * Zählt einen Euro-Betrag beim Erscheinen sichtbar hoch (~0,6s).
 * Server rendert direkt den Endwert (kein Layout-Sprung, funktioniert ohne JS);
 * bei „Bewegung reduzieren" wird gar nicht animiert.
 */
export function CountUp({
  cents,
  prefix = "",
  suffix = " €",
}: {
  cents: number;
  prefix?: string;
  suffix?: string;
}) {
  const [shown, setShown] = useState(cents);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    // Bei „Bewegung reduzieren" Dauer 0 → der erste Frame setzt sofort den Endwert
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : 600;
    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out
      setShown(Math.round(from + (cents - from) * eased));
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [cents]);

  return (
    <span className="tabular-nums">
      {prefix}
      {centsToEuroString(shown)}
      {suffix}
    </span>
  );
}
