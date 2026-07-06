"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function PasswordForm() {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Das Passwort muss mindestens 8 Zeichen haben.");
      return;
    }
    if (password !== repeat) {
      toast.error("Die Passwörter stimmen nicht überein.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      toast.error(`Passwort konnte nicht geändert werden: ${error.message}`);
      return;
    }
    toast.success("Passwort geändert");
    setPassword("");
    setRepeat("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="new-password">Neues Passwort</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="max-w-md"
        />
      </div>
      <div>
        <Label htmlFor="repeat-password">Neues Passwort wiederholen</Label>
        <Input
          id="repeat-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          className="max-w-md"
        />
      </div>
      <Button type="submit" variant="secondary" disabled={saving}>
        {saving ? "Ändern…" : "Passwort ändern"}
      </Button>
    </form>
  );
}
