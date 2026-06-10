import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const PUBLIC = join(process.cwd(), "public");
mkdirSync(PUBLIC, { recursive: true });

// ── SVG source ────────────────────────────────────────────
// Bold "M" on indigo (#6366f1), rounded square — clean at any size
const svg = (size: number) => {
  const r = Math.round(size * 0.18);   // corner radius ~18%
  const fontSize = Math.round(size * 0.62);
  const y = Math.round(size * 0.755);
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#6366f1"/>
  <text
    x="${size / 2}" y="${y}"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    font-size="${fontSize}"
    font-weight="800"
    text-anchor="middle"
    fill="white"
    letter-spacing="-2"
  >M</text>
</svg>`);
};

// ── Sizes to generate ─────────────────────────────────────
const sizes: { file: string; size: number }[] = [
  { file: "favicon-16x16.png",          size: 16  },
  { file: "favicon-32x32.png",          size: 32  },
  { file: "favicon-48x48.png",          size: 48  },
  { file: "apple-touch-icon.png",       size: 180 }, // iOS home screen
  { file: "icon-192.png",               size: 192 }, // Android / PWA
  { file: "icon-512.png",               size: 512 }, // Android splash / PWA
  { file: "mstile-150x150.png",         size: 150 }, // Windows tiles
];

async function main() {
  // PNG files
  for (const { file, size } of sizes) {
    await sharp(svg(size))
      .png()
      .toFile(join(PUBLIC, file));
    console.log(`✓ ${file}`);
  }

  // favicon.ico — multi-res (16 + 32 + 48) using raw PNG bytes
  // We use the 32px PNG as a single-size .ico (widely supported)
  const ico32 = await sharp(svg(32)).png().toBuffer();
  // Write a minimal valid ICO file containing the 32×32 PNG
  writeFileSync(join(PUBLIC, "favicon.ico"), buildIco(ico32, 32));
  console.log("✓ favicon.ico");

  // SVG version for modern browsers (no rasterisation loss)
  const svgContent = svg(512).toString();
  writeFileSync(join(PUBLIC, "icon.svg"), svgContent);
  console.log("✓ icon.svg");

  // Web app manifest
  const manifest = {
    name: "Maraminder",
    short_name: "Maraminder",
    description: "Amsterdam Marathon training plan tracker",
    theme_color: "#6366f1",
    background_color: "#0f0f11",
    display: "standalone",
    start_url: "/",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
  writeFileSync(join(PUBLIC, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("✓ manifest.json");

  console.log("\n✓ All icons generated.");
}

// ── Minimal ICO builder ───────────────────────────────────
// ICO format: ICONDIR + ICONDIRENTRY + image data
function buildIco(png: Buffer, size: number): Buffer {
  const HEADER_SIZE = 6;
  const ENTRY_SIZE  = 16;
  const dataOffset  = HEADER_SIZE + ENTRY_SIZE;

  const buf = Buffer.alloc(dataOffset + png.length);

  // ICONDIR
  buf.writeUInt16LE(0,    0); // reserved
  buf.writeUInt16LE(1,    2); // type: 1 = icon
  buf.writeUInt16LE(1,    4); // image count

  // ICONDIRENTRY
  buf.writeUInt8(size === 256 ? 0 : size, 6); // width (0 = 256)
  buf.writeUInt8(size === 256 ? 0 : size, 7); // height
  buf.writeUInt8(0,   8); // color count
  buf.writeUInt8(0,   9); // reserved
  buf.writeUInt16LE(1, 10); // planes
  buf.writeUInt16LE(32, 12); // bit count
  buf.writeUInt32LE(png.length, 14); // size of image data
  buf.writeUInt32LE(dataOffset,  18); // offset to image data

  png.copy(buf, dataOffset);
  return buf;
}

main().catch((e) => { console.error(e); process.exit(1); });
