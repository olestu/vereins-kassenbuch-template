"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { processReceiptImage } from "@/lib/image/process";
import { Button } from "@/components/ui/button";

interface Point {
  x: number;
  y: number;
}

interface CornerPoints {
  topLeftCorner: Point;
  topRightCorner: Point;
  bottomRightCorner: Point;
  bottomLeftCorner: Point;
}

interface CvMat {
  delete(): void;
}

interface Cv {
  imread(canvas: HTMLCanvasElement): CvMat;
  Mat: unknown;
}

/* OpenCV 4.x exponiert `cv` je nach Build als Thenable oder mit onRuntimeInitialized */
type CvGlobal = Cv & {
  then?: (cb: (cv: Cv) => void) => void;
  onRuntimeInitialized?: () => void;
};

interface JscanifyInstance {
  findPaperContour(mat: CvMat): CvMat | null;
  getCornerPoints(contour: CvMat): CornerPoints;
  extractPaper(
    image: HTMLCanvasElement,
    width: number,
    height: number,
    corners?: CornerPoints,
  ): HTMLCanvasElement;
}

declare global {
  interface Window {
    cv?: CvGlobal;
    jscanify?: new () => JscanifyInstance;
  }
}

/* OpenCV (~11 MB) nur einmal pro Session laden */
let scriptsPromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Laden fehlgeschlagen: ${src}`));
    document.head.appendChild(s);
  });
}

function loadScannerScripts(): Promise<void> {
  if (!scriptsPromise) {
    scriptsPromise = (async () => {
      await loadScript("/opencv/opencv.js");
      const cv = window.cv;
      if (!cv) throw new Error("OpenCV nicht verfügbar");
      if (!cv.Mat) {
        // WICHTIG: Das Promise nie mit dem Modul selbst auflösen — das alte
        // Emscripten-Thenable (Module.then ruft den Callback mit dem Modul auf)
        // würde sonst beim Auspacken endlos rekursieren und das await hängt für immer.
        await new Promise<void>((resolve) => {
          if (typeof cv.then === "function") {
            cv.then(() => resolve());
          } else {
            cv.onRuntimeInitialized = resolve;
          }
        });
      }
      await loadScript("/opencv/jscanify.min.js");
      if (!window.jscanify) throw new Error("jscanify nicht verfügbar");
    })().catch((err) => {
      // Fehlversuch komplett aufräumen, damit ein erneuter Versuch sauber startet
      scriptsPromise = null;
      document
        .querySelectorAll('script[src^="/opencv/"]')
        .forEach((s) => s.remove());
      throw err;
    });
  }
  return scriptsPromise;
}

type Phase = "loading" | "live" | "review" | "error";

const CORNER_KEYS: (keyof CornerPoints)[] = [
  "topLeftCorner",
  "topRightCorner",
  "bottomRightCorner",
  "bottomLeftCorner",
];

export function ReceiptScanner({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [corners, setCorners] = useState<CornerPoints | null>(null);
  const [stillUrl, setStillUrl] = useState<string | null>(null);
  const [stillSize, setStillSize] = useState<{ w: number; h: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const stillCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<JscanifyInstance | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const detectCorners = useCallback((canvas: HTMLCanvasElement): CornerPoints | null => {
    const cv = window.cv;
    const scanner = scannerRef.current;
    if (!cv || !scanner) return null;
    let mat: CvMat | null = null;
    let contour: CvMat | null = null;
    try {
      mat = cv.imread(canvas);
      contour = scanner.findPaperContour(mat);
      if (!contour) return null;
      return scanner.getCornerPoints(contour);
    } catch {
      return null;
    } finally {
      mat?.delete();
      contour?.delete();
    }
  }, []);

  const startLive = useCallback(async () => {
    try {
      // In-App-Browser (z.B. WhatsApp/Instagram) haben oft kein getUserMedia —
      // dort sofort in den Foto-Fallback statt ewig zu warten.
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("camera-unsupported");
      }

      // Ladephase absichern: statt endlosem Spinner nach 25s in den Foto-Fallback
      await Promise.race([
        loadScannerScripts(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("load-timeout")), 25_000),
        ),
      ]);
      scannerRef.current ??= new window.jscanify!();

      // Manche Browser lassen die Permission-Anfrage hängen statt abzulehnen
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("camera-timeout")), 12_000),
        ),
      ]);
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setPhase("live");

      // Live-Kantenerkennung (~4/s, auf verkleinertem Frame)
      const work = document.createElement("canvas");
      intervalRef.current = setInterval(() => {
        const v = videoRef.current;
        const overlay = overlayRef.current;
        if (!v || !overlay || v.videoWidth === 0) return;

        const scale = 480 / v.videoWidth;
        work.width = 480;
        work.height = Math.round(v.videoHeight * scale);
        work.getContext("2d")!.drawImage(v, 0, 0, work.width, work.height);

        const detected = detectCorners(work);

        overlay.width = work.width;
        overlay.height = work.height;
        const ctx = overlay.getContext("2d")!;
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        if (detected) {
          // Sanft pulsierender Rahmen zeigt: Kanten werden live erkannt
          const pulse = window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? 1
            : 0.7 + 0.3 * Math.sin(Date.now() / 250);
          ctx.strokeStyle = `rgba(74, 222, 128, ${pulse})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          const pts = CORNER_KEYS.map((k) => detected[k]);
          ctx.moveTo(pts[0].x, pts[0].y);
          for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
          ctx.closePath();
          ctx.stroke();
        }
      }, 250);
    } catch {
      stopCamera();
      setPhase("error");
    }
  }, [detectCorners, stopCamera]);

  /* Für „Neu aufnehmen": Review-State zurücksetzen, dann Kamera neu starten */
  const retake = useCallback(() => {
    setPhase("loading");
    setStillUrl(null);
    setStillSize(null);
    setCorners(null);
    void startLive();
  }, [startLive]);

  useEffect(() => {
    // Kamera = externes System; setState passiert nur in async Callbacks nach den awaits
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void startLive();
    return stopCamera;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleShutter() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      // Kein Kamerabild verfügbar: statt stummem Nichtstun in den Foto-Fallback
      stopCamera();
      setPhase("error");
      return;
    }
    setFlash(true);
    // Nicht auf onAnimationEnd verlassen — bei „Bewegung reduzieren" feuert es nie
    window.setTimeout(() => setFlash(false), 500);

    try {
      const still = document.createElement("canvas");
      still.width = video.videoWidth;
      still.height = video.videoHeight;
      still.getContext("2d")!.drawImage(video, 0, 0);
      stillCanvasRef.current = still;

      // Ecken auf verkleinerter Kopie suchen, dann hochskalieren
      const work = document.createElement("canvas");
      const scale = 640 / still.width;
      work.width = 640;
      work.height = Math.round(still.height * scale);
      work.getContext("2d")!.drawImage(still, 0, 0, work.width, work.height);

      const detected = detectCorners(work);
      const margin = 0.08;
      const fallback: CornerPoints = {
        topLeftCorner: { x: still.width * margin, y: still.height * margin },
        topRightCorner: { x: still.width * (1 - margin), y: still.height * margin },
        bottomRightCorner: { x: still.width * (1 - margin), y: still.height * (1 - margin) },
        bottomLeftCorner: { x: still.width * margin, y: still.height * (1 - margin) },
      };

      setCorners(
        detected
          ? {
              topLeftCorner: scalePoint(detected.topLeftCorner, 1 / scale),
              topRightCorner: scalePoint(detected.topRightCorner, 1 / scale),
              bottomRightCorner: scalePoint(detected.bottomRightCorner, 1 / scale),
              bottomLeftCorner: scalePoint(detected.bottomLeftCorner, 1 / scale),
            }
          : fallback,
      );
      setStillUrl(still.toDataURL("image/jpeg", 0.9));
      setStillSize({ w: still.width, h: still.height });
      stopCamera();
      setPhase("review");
    } catch {
      stopCamera();
      setPhase("error");
    }
  }

  async function finish(crop: boolean) {
    const still = stillCanvasRef.current;
    if (!still || busy) return;
    setBusy(true);
    try {
      let source: HTMLCanvasElement = still;

      if (crop && corners && scannerRef.current) {
        const w = Math.round(
          (dist(corners.topLeftCorner, corners.topRightCorner) +
            dist(corners.bottomLeftCorner, corners.bottomRightCorner)) /
            2,
        );
        const h = Math.round(
          (dist(corners.topLeftCorner, corners.bottomLeftCorner) +
            dist(corners.topRightCorner, corners.bottomRightCorner)) /
            2,
        );
        if (w > 50 && h > 50) {
          source = scannerRef.current.extractPaper(still, w, h, corners);
        }
      }

      const blob = await processReceiptImage(source);
      onCapture(new File([blob], `beleg-${Date.now()}.jpg`, { type: "image/jpeg" }));
    } catch {
      setPhase("error");
    } finally {
      setBusy(false);
    }
  }

  function handleCornerDrag(key: keyof CornerPoints, e: React.PointerEvent) {
    const img = imgRef.current;
    const still = stillCanvasRef.current;
    if (!img || !still) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const rect = img.getBoundingClientRect();
    const factorX = still.width / rect.width;
    const factorY = still.height / rect.height;

    const move = (ev: PointerEvent) => {
      const x = Math.min(Math.max(0, (ev.clientX - rect.left) * factorX), still.width);
      const y = Math.min(Math.max(0, (ev.clientY - rect.top) * factorY), still.height);
      setCorners((c) => (c ? { ...c, [key]: { x, y } } : c));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function handleFallbackFile(file: File | null) {
    if (file) onCapture(file);
  }

  // Portal an <body>: Das Vollbild-Overlay darf nie innerhalb des Seiteninhalts
  // hängen — dessen Animations-Ebenen (Stacking Context) und die fixe Bottom-Nav
  // würden sonst Teile des Scanners überdecken bzw. Taps auf den Auslöser schlucken.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-4">
        <span className="text-sm font-medium text-white">Beleg scannen</span>
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          aria-label="Scanner schließen"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
        >
          ✕
        </button>
      </div>

      {phase === "loading" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <p className="text-sm">Scanner wird geladen…</p>
        </div>
      )}

      {phase === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-white">
          <p className="text-sm">
            Der Live-Scanner konnte hier nicht geladen werden — das passiert z.&nbsp;B. im
            WhatsApp-Browser, bei sehr langsamer Verbindung oder wenn die
            Kamera-Berechtigung fehlt. Tipp: Link in Safari/Chrome öffnen. Oder nimm
            direkt ein Foto auf:
          </p>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handleFallbackFile(e.target.files?.[0] ?? null)}
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink"
          />
        </div>
      )}

      <div className={`relative flex-1 overflow-hidden ${phase === "live" ? "" : "hidden"}`}>
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-contain"
        />
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
        {flash && (
          <div className="animate-shutter pointer-events-none absolute inset-0 bg-white" />
        )}
      </div>

      {phase === "live" && (
        <div className="flex items-center justify-center p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button
            onClick={handleShutter}
            aria-label="Foto aufnehmen"
            className="h-16 w-16 rounded-full border-4 border-white/40 bg-white active:scale-95"
          />
        </div>
      )}

      {phase === "review" && stillUrl && stillSize && (
        <>
          <div className="animate-page-in relative flex-1 overflow-auto p-4">
            <div className="relative mx-auto w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={stillUrl}
                alt="Aufgenommener Beleg"
                className="max-h-[60vh] w-auto select-none"
                draggable={false}
              />
              {corners && (
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox={`0 0 ${stillSize.w} ${stillSize.h}`}
                  preserveAspectRatio="none"
                >
                  <polygon
                    points={CORNER_KEYS.map((k) => `${corners[k].x},${corners[k].y}`).join(" ")}
                    fill="rgba(74, 222, 128, 0.15)"
                    stroke="#4ade80"
                    strokeWidth={stillSize.w / 200}
                  />
                </svg>
              )}
              {corners &&
                CORNER_KEYS.map((key) => (
                  <div
                    key={key}
                    onPointerDown={(e) => handleCornerDrag(key, e)}
                    style={{
                      left: `${(corners[key].x / stillSize.w) * 100}%`,
                      top: `${(corners[key].y / stillSize.h) * 100}%`,
                    }}
                    className="absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-move touch-none rounded-full"
                  >
                    <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary-500 shadow" />
                  </div>
                ))}
            </div>
            <p className="mt-3 text-center text-xs text-white/70">
              Ecken bei Bedarf zurechtziehen
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button variant="secondary" size="sm" onClick={retake} disabled={busy}>
              Neu aufnehmen
            </Button>
            <Button variant="secondary" size="sm" onClick={() => finish(false)} disabled={busy}>
              Ohne Zuschnitt
            </Button>
            <Button onClick={() => finish(true)} disabled={busy}>
              {busy ? "Verarbeite…" : "Zuschneiden & übernehmen"}
            </Button>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function scalePoint(p: Point, factor: number): Point {
  return { x: p.x * factor, y: p.y * factor };
}
