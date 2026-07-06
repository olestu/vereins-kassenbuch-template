"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Rendert die erste PDF-Seite mit pdf.js in ein Canvas — funktioniert damit
 * auch auf iOS/Android zuverlässig (native PDF-Einbettung tut das nicht).
 */
export function PdfPreview({
  url,
  thumb = false,
}: {
  url: string;
  /** true = kleine Kachel-Vorschau (Galerie), false = große Ansicht */
  thumb?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [numPages, setNumPages] = useState(1);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | null = null;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const task = pdfjs.getDocument({ url });
        destroy = () => void task.destroy();
        const doc = await task.promise;
        if (cancelled) return;

        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const targetWidth = thumb ? 320 : 1100;
        const scale = Math.min(3, targetWidth / base.width);
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext("2d")!;

        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        if (cancelled) return;

        setNumPages(doc.numPages);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [url, thumb]);

  if (status === "error") {
    if (thumb) {
      return (
        <span className="flex h-full w-full items-center justify-center text-xs font-medium text-ink-muted">
          PDF
        </span>
      );
    }
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <p className="text-sm text-ink-secondary">Vorschau nicht möglich.</p>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-10 items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          PDF öffnen
        </a>
      </div>
    );
  }

  if (thumb) {
    return (
      <span className="relative block h-full w-full overflow-hidden">
        {status === "loading" && (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-ink-muted">
            PDF…
          </span>
        )}
        <canvas ref={canvasRef} className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <div>
      {status === "loading" && (
        <p className="flex items-center justify-center gap-2 py-12 text-sm text-ink-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          PDF wird geladen…
        </p>
      )}
      <canvas
        ref={canvasRef}
        className={`mx-auto h-auto w-auto max-w-full rounded-lg ${status === "ready" ? "max-h-[75vh]" : "hidden"}`}
      />
      {status === "ready" && numPages > 1 && (
        <p className="mt-2 text-center text-xs text-ink-muted">
          Seite 1 von {numPages} —{" "}
          <a href={url} target="_blank" rel="noreferrer" className="underline">
            ganzes PDF öffnen
          </a>
        </p>
      )}
    </div>
  );
}
