"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import {
  createCategory,
  createOfficialCategories,
  setCategoryActive,
  setCategoryEuerLine,
} from "@/lib/actions/categories";
import { EUER_LINES } from "@/lib/profile";
import { useSettings } from "@/components/settings-provider";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { TypeBadge } from "@/components/ui/badge";
import type { Category } from "@/lib/types";

export function CategoryManager({ categories }: { categories: Category[] }) {
  const { isBusiness } = useSettings();
  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("income");
  const [euerLine, setEuerLine] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isPending, startTransition] = useTransition();

  const income = categories.filter((c) => c.type === "income");
  const expense = categories.filter((c) => c.type === "expense");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    startTransition(async () => {
      try {
        await createCategory(name, type, {
          euerLine: isPrivate ? null : euerLine || null,
          isPrivate,
        });
        toast.success(`Kategorie „${name.trim()}" angelegt`);
        setName("");
        setEuerLine("");
        setIsPrivate(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler beim Anlegen");
      }
    });
  }

  return (
    <div className="space-y-8">
      <Card className="p-4">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Sponsoring"
              className="w-52"
              maxLength={80}
            />
          </div>
          <div>
            <Label htmlFor="cat-type">Typ</Label>
            <Select
              id="cat-type"
              value={type}
              onChange={(e) => {
                setType(e.target.value as "income" | "expense");
                setEuerLine("");
              }}
              className="w-40"
            >
              <option value="income">Einnahme</option>
              <option value="expense">Ausgabe</option>
            </Select>
          </div>
          {!isPrivate && (
            <div>
              <Label htmlFor="cat-euer">EÜR-Zuordnung</Label>
              <Select
                id="cat-euer"
                value={euerLine}
                onChange={(e) => setEuerLine(e.target.value)}
                className="w-64"
              >
                <option value="">— automatisch (Sonstige) —</option>
                {EUER_LINES[type].map((line) => (
                  <option key={line} value={line}>
                    {line}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {isBusiness && (
            <label className="flex min-h-10 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="accent-primary-600"
              />
              Privat (Entnahme/Einlage)
            </label>
          )}
          <Button type="submit" disabled={isPending}>
            Hinzufügen
          </Button>
        </form>
        {isBusiness && (
          <p className="mt-3 text-xs text-ink-muted">
            Private Kategorien (Privatentnahme/-einlage) verändern den Kassenbestand,
            zählen aber nicht als Betriebseinnahme/-ausgabe in der EÜR.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                try {
                  const created = await createOfficialCategories();
                  toast.success(
                    created > 0
                      ? `${created} offizielle Kategorien angelegt`
                      : "Alle offiziellen Kategorien existieren bereits",
                  );
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Fehler beim Anlegen");
                }
              })
            }
          >
            Offizielle Kategorien anlegen
          </Button>
          <p className="max-w-md text-xs text-ink-muted">
            Legt die amtlichen Ausgaben- und Einnahmen-Gruppen der Anlage EÜR als
            Kategorien an — inklusive korrekter Zuordnung für die
            ELSTER-Ausfüllhilfe im Jahresbericht.
          </p>
        </div>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <CategoryList title="Einnahmen" type="income" categories={income} />
        <CategoryList title="Ausgaben" type="expense" categories={expense} />
      </div>
    </div>
  );
}

function CategoryList({
  title,
  type,
  categories,
}: {
  title: string;
  type: "income" | "expense";
  categories: Category[];
}) {
  const [, startTransition] = useTransition();

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <TypeBadge type={type} />
      </div>
      <Card>
        <ul className="divide-y divide-line/60">
          {categories.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-ink-muted">Keine Kategorien</li>
          )}
          {categories.map((c) => (
            <li key={c.id} className="px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`flex items-center gap-2 text-sm ${
                    c.is_active ? "text-ink" : "text-ink-muted line-through"
                  }`}
                >
                  {c.name}
                  {c.is_private && (
                    <span className="rounded-full bg-page px-2 py-0.5 text-xs font-medium text-ink-secondary">
                      Privat
                    </span>
                  )}
                </span>
                <button
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await setCategoryActive(c.id, !c.is_active);
                        toast.success(
                          c.is_active ? `„${c.name}" deaktiviert` : `„${c.name}" aktiviert`,
                        );
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Fehler");
                      }
                    })
                  }
                  className="shrink-0 text-xs font-medium text-primary-700 hover:underline"
                >
                  {c.is_active ? "Deaktivieren" : "Aktivieren"}
                </button>
              </div>

              {!c.is_private && (
                <select
                  value={c.euer_line ?? ""}
                  onChange={(e) =>
                    startTransition(async () => {
                      try {
                        await setCategoryEuerLine(c.id, e.target.value || null);
                        toast.success("EÜR-Zuordnung gespeichert");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Fehler");
                      }
                    })
                  }
                  className="mt-1.5 w-full rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink-secondary focus:border-primary-500 focus:outline-none"
                >
                  <option value="">EÜR: automatisch (Sonstige)</option>
                  {EUER_LINES[c.type].map((line) => (
                    <option key={line} value={line}>
                      EÜR: {line}
                    </option>
                  ))}
                </select>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
