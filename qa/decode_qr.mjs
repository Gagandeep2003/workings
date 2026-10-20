// Usage: node qa/decode_qr.mjs file.png  → prints the decoded text (uses the repo's jsqr + upng-js)
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const jsQR = require("jsqr");
const UPNG = require("upng-js");
const buf = fs.readFileSync(process.argv[2]);
const png = UPNG.decode(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const rgba = new Uint8ClampedArray(UPNG.toRGBA8(png)[0]);
const r = jsQR(rgba, png.width, png.height);
process.stdout.write(r ? r.data : "NO-QR-FOUND");
