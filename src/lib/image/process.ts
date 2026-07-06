const MAX_LONG_EDGE = 1600;
const JPEG_QUALITY = 0.8;

/**
 * Skaliert ein Bild auf max. 1600px lange Kante und re-encodiert als JPEG.
 * Der Canvas-Roundtrip entfernt dabei EXIF-Daten (inkl. GPS) und wendet die
 * EXIF-Rotation an (createImageBitmap mit imageOrientation).
 */
export async function processReceiptImage(source: Blob | HTMLCanvasElement): Promise<Blob> {
  const canvas =
    source instanceof HTMLCanvasElement ? source : await blobToCanvas(source);

  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(canvas.width, canvas.height));
  let out = canvas;

  if (scale < 1) {
    out = document.createElement("canvas");
    out.width = Math.round(canvas.width * scale);
    out.height = Math.round(canvas.height * scale);
    const ctx = out.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
  }

  return canvasToJpeg(out);
}

async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("JPEG-Encoding fehlgeschlagen"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
