"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acceptRequest, rejectRequest } from "@/lib/actions/reimbursements";
import { centsToEuroString, euroStringToCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import type { Category, PaymentMethod, ReimbursementRequest } from "@/lib/types";

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "bank", label: "Überweisung" },
  { value: "cash", label: "Bar" },
  { value: "other", label: "Sonstige" },
];

export function RequestReview({
  request,
  categories,
}: {
  request: ReimbursementRequest;
  categories: Category[];
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(request.category_id ?? "");
  const [amount, setAmount] = useState(centsToEuroString(request.amount_cents));
  const [occurredOn, setOccurredOn] = useState(request.occurred_on);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank");
  const [payee, setPayee] = useState(request.submitter_name);
  const [description, setDescription] = useState(
    request.description
      ? `Erstattung ${request.submitter_name}: ${request.description}`
      : `Erstattung ${request.submitter_name}`,
  );
  const [rejectComment, setRejectComment] = useState("");
  const [showReject, setShowReject] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const expenseCategories = categories.filter((c) => c.type === "expense" && c.is_active);

  function handleAccept(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amountCents = euroStringToCents(amount);
    if (!categoryId) return setError("Bitte eine Kategorie wählen.");
    if (!amountCents) return setError("Bitte einen gültigen Betrag eintragen.");

    startTransition(async () => {
      try {
        await acceptRequest(request.id, {
          categoryId,
          amountCents,
          occurredOn,
          paymentMethod,
          payee,
          description,
        });
        toast.success("Antrag angenommen — Buchung wurde angelegt");
        router.push("/antraege");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Fehler beim Annehmen";
        setError(message);
        toast.error(message);
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      try {
        await rejectRequest(request.id, rejectComment);
        toast.success("Antrag abgelehnt");
        router.push("/antraege");
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Fehler beim Ablehnen";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleAccept} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="r-date">Datum</Label>
            <Input
              id="r-date"
              type="date"
              required
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="r-amount">Betrag (EUR)</Label>
            <Input
              id="r-amount"
              type="text"
              inputMode="decimal"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="r-category">Kategorie (Ausgabe)</Label>
          <Select
            id="r-category"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Bitte wählen…</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-ink-secondary">
            Zahlungsart der Erstattung
          </legend>
          <div className="flex gap-4">
            {PAYMENT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex min-h-10 items-center gap-1.5 text-sm text-ink"
              >
                <input
                  type="radio"
                  name="r-paymentMethod"
                  value={opt.value}
                  checked={paymentMethod === opt.value}
                  onChange={() => setPaymentMethod(opt.value)}
                  className="accent-primary-600"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <Label htmlFor="r-payee">Zahlungsempfänger/-in</Label>
          <Input
            id="r-payee"
            type="text"
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="r-description">Verwendungszweck</Label>
          <Textarea
            id="r-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-expense-bg px-3 py-2 text-sm font-medium text-expense-text"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird verarbeitet…" : "Annehmen & Buchung anlegen"}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={isPending}
            onClick={() => setShowReject((v) => !v)}
          >
            Ablehnen…
          </Button>
        </div>

        {showReject && (
          <div className="rounded-lg border border-expense/30 bg-expense-bg/50 p-4">
            <Label htmlFor="r-reject">Kommentar für das Mitglied (optional)</Label>
            <Textarea
              id="r-reject"
              rows={2}
              maxLength={500}
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              placeholder="z.B. Beleg unleserlich — bitte neu einreichen"
            />
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="mt-3 border border-expense/40"
              disabled={isPending}
              onClick={handleReject}
            >
              Endgültig ablehnen
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}
