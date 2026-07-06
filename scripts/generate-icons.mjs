// Generiert PWA-Icons aus public/logo.png (einmalig ausführen: node scripts/generate-icons.mjs)
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = "public/logo.png";
const OUT = "public/icons";

await mkdir(OUT, { recursive: true });

/** Logo zentriert auf weißem Quadrat; scale = Anteil der Kantenlänge fürs Logo */
async function icon(size, scale, dest) {
  const inner = Math.round(size * scale);
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: "inside" })
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(dest);

  console.log(`✓ ${dest}`);
}

await icon(192, 0.72, `${OUT}/icon-192.png`);
await icon(512, 0.72, `${OUT}/icon-512.png`);
// Maskable: Inhalt muss in der inneren 80%-Zone liegen
await icon(192, 0.55, `${OUT}/icon-maskable-192.png`);
await icon(512, 0.55, `${OUT}/icon-maskable-512.png`);
await icon(180, 0.72, "src/app/apple-icon.png");
