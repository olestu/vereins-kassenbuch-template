/**
 * Rendert die erste Seite eines PDFs als JPEG-Blob (für die Auslesung).
 * pdfjs-dist wird lazy geladen; der Worker liegt in public/pdf.worker.min.mjs.
 */
export async function renderPdfFirstPage(pdf: Blob): Promise<Blob> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const loadingTask = pdfjs.getDocument({ data: await pdf.arrayBuffer() });
  const doc = await loadingTask.promise;
  try {
    const page = await doc.getPage(1);
    // Auf ~1600px lange Kante skalieren
    const base = page.getViewport({ scale: 1 });
    const scale = 1600 / Math.max(base.width, base.height);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PDF-Rendering fehlgeschlagen"))),
        "image/jpeg",
        0.85,
      );
    });
  } finally {
    await loadingTask.destroy();
  }
}
