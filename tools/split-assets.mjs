import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const root = path.resolve(import.meta.dirname, "..");
const indexFile = path.join(root, "index.html");
const assetRoot = path.join(root, "assets");
const html = await readFile(indexFile, "utf8");
const tagPattern =
  /<script id="embedded-assets" type="application\/json">([\s\S]*?)<\/script>/;
const match = html.match(tagPattern);

if (!match) {
  throw new Error("Could not find the embedded asset payload in index.html");
}

const packed = JSON.parse(match[1]);
const manifest = [];
let totalBytes = 0;

for (const [name, item] of Object.entries(packed)) {
  if (!item?.gzip || !Number.isFinite(item.size)) {
    throw new Error(`Invalid asset entry: ${name}`);
  }

  const encoded = Buffer.from(item.gzip, "base64");
  const bytes = gunzipSync(encoded);
  if (bytes.byteLength !== item.size) {
    throw new Error(
      `Asset length mismatch for ${name}: expected ${item.size}, got ${bytes.byteLength}`,
    );
  }

  const target = path.join(assetRoot, ...name.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);

  manifest.push({ path: name, bytes: item.size });
  totalBytes += item.size;
}

manifest.sort((a, b) => a.path.localeCompare(b.path));
await writeFile(
  path.join(assetRoot, "manifest.json"),
  `${JSON.stringify({ totalBytes, assets: manifest }, null, 2)}\n`,
);

const externalized = html.replace(tagPattern, "").trimStart();
await writeFile(indexFile, externalized);

console.log(
  `Extracted ${manifest.length} assets (${(totalBytes / 1024 / 1024).toFixed(1)} MiB)`,
);
