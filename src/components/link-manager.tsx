"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { createLink, setLinkActive } from "@/lib/actions/reimbursements";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import type { ReimbursementLink } from "@/lib/types";

export function LinkManager({ links }: { links: ReimbursementLink[] }) {
  const [label, setLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createLink(label, expiresAt || null);
        toast.success("Link erzeugt");
        setLabel("");
        setExpiresAt("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler beim Erzeugen");
      }
    });
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/einreichen/${token}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Link kopiert — z.B. in die WhatsApp-Gruppe einfügen"))
      .catch(() => toast.error("Kopieren fehlgeschlagen"));
  }

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold text-ink">Einreichungs-Links</h2>
      <p className="mb-4 text-sm text-ink-secondary">
        Teile einen Link (WhatsApp, E-Mail) — darüber lassen sich ohne Login
        Erstattungsanträge mit Beleg einreichen.
      </p>

      <form onSubmit={handleCreate} className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="link-label">Bezeichnung (optional)</Label>
          <Input
            id="link-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="z.B. Team 2026"
            className="w-48"
            maxLength={80}
          />
        </div>
        <div>
          <Label htmlFor="link-expiry">Gültig bis (optional)</Label>
          <Input
            id="link-expiry"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-44"
          />
        </div>
        <Button type="submit" disabled={isPending}>
          Link erzeugen
        </Button>
      </form>

      {links.length > 0 && (
        <ul className="divide-y divide-line/60 rounded-lg border border-line">
          {links.map((link) => {
            const expired = link.expires_at && new Date(link.expires_at) < new Date();
            const usable = link.is_active && !expired;
            return (
              <li
                key={link.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${usable ? "text-ink" : "text-ink-muted line-through"}`}>
                    {link.label || "Einreichungs-Link"}
                  </p>
                  <p className="text-xs text-ink-muted">
                    erstellt {new Date(link.created_at).toLocaleDateString("de-DE")}
                    {link.expires_at &&
                      ` · ${expired ? "abgelaufen" : "gültig bis"} ${new Date(link.expires_at).toLocaleDateString("de-DE")}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {usable && (
                    <Button variant="secondary" size="sm" onClick={() => copyLink(link.token)}>
                      Link kopieren
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          await setLinkActive(link.id, !link.is_active);
                          toast.success(link.is_active ? "Link deaktiviert" : "Link aktiviert");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Fehler");
                        }
                      })
                    }
                  >
                    {link.is_active ? "Deaktivieren" : "Aktivieren"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
