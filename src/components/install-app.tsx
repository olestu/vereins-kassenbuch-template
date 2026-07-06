"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Chrome/Edge (Android + Desktop) liefern dieses Event für den echten Install-Prompt */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Mode = "unknown" | "installed" | "native-prompt" | "ios" | "manual";

function detectIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS meldet sich als "Macintosh" mit Touch-Unterstützung
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function detectStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * „Zum Startbildschirm"-Hilfe: Auf Android/Chrome ein echter Install-Knopf;
 * auf dem iPhone (Apple erlaubt keinen programmatischen Install) eine
 * Schritt-für-Schritt-Anleitung. Verschwindet, sobald die App installiert ist.
 */
export function InstallApp({ variant = "card" }: { variant?: "card" | "banner" }) {
  const [mode, setMode] = useState<Mode>("unknown");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosSteps, setShowIosSteps] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Installations-Status & localStorage sind externe Browser-Systeme,
    // die erst nach dem Mount lesbar sind
    if (detectStandalone()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- einmaliges Lesen externer Browser-Zustände beim Mount
      setMode("installed");
      return;
    }
    if (variant === "banner" && localStorage.getItem("vk-install-dismissed") === "1") {
      setDismissed(true);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("native-prompt");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // Falls das Event nicht kommt (iOS/Firefox/…): passenden Hinweis zeigen
    const fallback = setTimeout(() => {
      setMode((m) => (m === "unknown" ? (detectIos() ? "ios" : "manual") : m));
    }, 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      clearTimeout(fallback);
    };
  }, [variant]);

  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setMode("installed");
    setDeferred(null);
  }

  function dismissBanner() {
    localStorage.setItem("vk-install-dismissed", "1");
    setDismissed(true);
  }

  if (mode === "unknown" || mode === "installed" || dismissed) {
    if (mode === "installed" && variant === "card") {
      return (
        <p className="text-sm text-income-text">
          ✓ Läuft bereits als installierte App auf diesem Gerät.
        </p>
      );
    }
    return null;
  }

  const body = (
    <>
      {mode === "native-prompt" && (
        <Button onClick={handleInstall}>App installieren</Button>
      )}

      {mode === "ios" && !showIosSteps && (
        <Button onClick={() => setShowIosSteps(true)}>
          Zum Home-Bildschirm hinzufügen
        </Button>
      )}

      {mode === "ios" && showIosSteps && (
        <ol className="space-y-3 text-sm text-ink">
          <li className="flex items-center gap-3">
            <StepNr n={1} />
            <span>
              In <strong>Safari</strong> unten das <strong>Teilen-Symbol</strong>
              <ShareIcon /> antippen
            </span>
          </li>
          <li className="flex items-center gap-3">
            <StepNr n={2} />
            <span>
              Nach unten wischen und <strong>„Zum Home-Bildschirm“</strong>
              <PlusIcon /> wählen
            </span>
          </li>
          <li className="flex items-center gap-3">
            <StepNr n={3} />
            <span>
              Oben rechts auf <strong>„Hinzufügen“</strong> tippen — fertig! Die App
              erscheint mit eigenem Logo auf dem Home-Bildschirm.
            </span>
          </li>
        </ol>
      )}

      {mode === "manual" && (
        <p className="text-sm text-ink-secondary">
          In Chrome oder Edge findest du das Installieren-Symbol rechts in der
          Adressleiste; am iPhone öffne die Seite in Safari und nutze das Teilen-Menü
          → „Zum Home-Bildschirm“.
        </p>
      )}
    </>
  );

  if (variant === "banner") {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 border-primary-200 bg-primary-50 p-4 md:hidden">
        <div className="min-w-52 flex-1">
          <p className="text-sm font-semibold text-ink">Als App aufs Handy</p>
          <p className="text-xs text-ink-secondary">
            Mit eigenem Symbol auf dem Startbildschirm — startet schneller und fühlt
            sich wie eine echte App an.
          </p>
          {showIosSteps && <div className="mt-3">{mode === "ios" ? body : null}</div>}
        </div>
        {!showIosSteps && body}
        <button
          onClick={dismissBanner}
          aria-label="Hinweis ausblenden"
          className="rounded-full p-1 text-ink-muted hover:bg-primary-100 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </Card>
    );
  }

  return <div className="space-y-3">{body}</div>;
}

function StepNr({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
      {n}
    </span>
  );
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="mx-1 inline h-5 w-5 align-text-bottom text-primary-700"
      aria-label="Teilen-Symbol"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12M8 7l4-4 4 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 11v8a1 1 0 001 1h12a1 1 0 001-1v-8" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="mx-1 inline h-5 w-5 align-text-bottom text-primary-700"
      aria-label="Plus-Symbol"
    >
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path strokeLinecap="round" d="M12 9v6M9 12h6" />
    </svg>
  );
}
