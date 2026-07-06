"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createAppUser, resetUserPassword } from "@/lib/actions/admin-users";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export interface AdminUserInfo {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  lastSignInAt: string | null;
  isAdmin: boolean;
}

export function AdminUserManager({ users }: { users: AdminUserInfo[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createAppUser(email, username, password);
        toast.success(`Nutzer „${username.trim()}" angelegt`);
        setEmail("");
        setUsername("");
        setPassword("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler beim Anlegen");
      }
    });
  }

  function handleReset(user: AdminUserInfo) {
    const newPassword = prompt(
      `Neues Passwort für ${user.username || user.email} (mind. 8 Zeichen):`,
    );
    if (!newPassword) return;
    startTransition(async () => {
      try {
        await resetUserPassword(user.id, newPassword);
        toast.success(`Passwort für ${user.username || user.email} geändert`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler beim Zurücksetzen");
      }
    });
  }

  return (
    <div className="space-y-5">
      <ul className="divide-y divide-line/60 rounded-lg border border-line">
        {users.map((u) => (
          <li
            key={u.id}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <span className="truncate">{u.username || "—"}</span>
                {u.isAdmin && (
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-800">
                    Admin
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-ink-muted">
                {u.email} · zuletzt angemeldet:{" "}
                {u.lastSignInAt
                  ? new Date(u.lastSignInAt).toLocaleDateString("de-DE")
                  : "noch nie"}
              </p>
            </div>
            <button
              onClick={() => handleReset(u)}
              disabled={isPending}
              className="shrink-0 text-xs font-medium text-primary-700 hover:underline"
            >
              Passwort zurücksetzen
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="nu-email">E-Mail</Label>
          <Input
            id="nu-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-56"
          />
        </div>
        <div>
          <Label htmlFor="nu-name">Benutzername</Label>
          <Input
            id="nu-name"
            type="text"
            required
            maxLength={60}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-44"
          />
        </div>
        <div>
          <Label htmlFor="nu-pass">Startpasswort</Label>
          <Input
            id="nu-pass"
            type="text"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-44"
            autoComplete="off"
          />
        </div>
        <Button type="submit" disabled={isPending}>
          Nutzer anlegen
        </Button>
      </form>
      <p className="text-xs text-ink-muted">
        Der neue Nutzer meldet sich mit E-Mail und Startpasswort an, wählt beim ersten
        Login sein Profil (Verein oder Kleinunternehmen) und kann das Passwort danach
        selbst unter Einstellungen → Konto ändern.
      </p>
    </div>
  );
}
