# Image, PDF and QR tools

These tools (`/image-pdf/*` and `/developer/qr-code-generator`) run **entirely in the visitor's browser**. Files are never uploaded; there is no server code, database or paid service behind them, so they add no hosting cost beyond static files and bandwidth for the page and its JavaScript.

## What exists

| Tool | Route | What it does |
| --- | --- | --- |
| Image Compressor | `/image-pdf/image-compressor` | JPG/PNG/WebP, by quality or to a target KB, batch + ZIP, before/after |
| Image Resizer | `/image-pdf/image-resizer` | Pixels, percent, cm/mm/inch at a DPI; keeps proportions; optional max KB |
| Image Converter | `/image-pdf/image-converter` | JPG ⇄ PNG ⇄ WebP, batch, transparency warnings |
| Passport Photo Resizer | `/image-pdf/passport-photo-resizer` | Exact pixels + KB window, crop frame, padding to a minimum size |
| Signature Resizer | `/image-pdf/signature-resizer` | Same component with signature defaults and scan clean-up |
| JPG to PDF | `/image-pdf/jpg-to-pdf` | Order, rotate, page size, margins; JPEGs embedded losslessly |
| Merge PDF | `/image-pdf/merge-pdf` | Order, page counts, password-protected files |
| Split PDF | `/image-pdf/split-pdf` | Extract / split by range / every page / every N / remove pages |
| PDF Compressor | `/image-pdf/pdf-compressor` | Re-compress pictures (keeps text) or redraw pages (maximum), KB target |
| QR Code Generator | `/developer/qr-code-generator` | URL, text, Wi-Fi, vCard, email, phone, SMS, UPI; PNG + SVG |
| Wi-Fi / UPI QR | `/image-pdf/wifi-qr-code-generator`, `/image-pdf/upi-qr-code-generator` | Same component, locked to one content type |

## How it is built

* **Registry.** A client tool is an ordinary `ToolDefinition` with `client: { component, preset }` and `engineModule: "client"`. It has no `inputs`/`examples`; it carries `specs`, `practicalExamples`, FAQs and a formula instead (see `docs/ADDING_A_TOOL.md`). `validate.ts` enforces this, and the usual rules (unique title/description, related tools, no hype wording, no repeated sentences) still apply.
* **Page.** `ToolPageView` renders the interface through `ClientToolHost` (client component, `next/dynamic`, `ssr: false`). Everything around it — how-to text, specs table, examples, FAQ, related tools, JSON-LD — is server-rendered HTML, so it is crawlable without JavaScript.
* **Libraries (`src/lib/files`).** `image.ts` (decode with EXIF orientation, halving-step resampling, JPEG/WebP/PNG encoding, quality search for a target size, transparency detection), `imageOps.ts`, `pad.ts` (invisible filler to reach a *minimum* size), `zip.ts` (a small store-only ZIP writer, no dependency), `pdf.ts` (build / merge / split / recompress / rasterise), `qr.ts` and `qrmatrix.ts` (payload formats and the module matrix), `format.ts`.
* **Interface (`src/components/files`).** `BatchShell` is the shared flow for the three batch image tools; `PhotoResizer`, `JpgToPdf`, `PdfMerge`, `PdfSplit`, `PdfCompress` and `QrGenerator` are separate components. `ui.tsx` holds the drop zone, notices, fields and `BlobImage`.
* **Size limits.** 1 KB = 1024 bytes everywhere in the interface. For *upload limits* the maximum is aimed at `KB × 1000` bytes and the minimum at `KB × 1024`, so a file passes whichever convention a portal uses.

## Honest limits (also stated on the pages)

* JPG/WebP compression is lossy; PNG is reduced by lowering its colour count. EXIF metadata is dropped on re-encoding. Animated GIF/WebP keep only the first frame. HEIC works only in browsers that can display it.
* WebP *output* depends on the browser's encoder; the tool detects this and says so.
* PDF merge/split copy page content but not bookmarks, form fields or digital signatures. Password-protected PDFs need the password; outputs are not protected.
* PDF compression: "keep text" re-compresses embedded JPEG and plain RGB/grey images (including JPEGs wrapped in ASCII85/Flate) and leaves text, fonts and links alone; CMYK, indexed and masked images are skipped. "Maximum" redraws pages as pictures (text is no longer selectable). Text-only PDFs may not shrink. No OCR anywhere.
* The photo and signature **presets are commonly published values, not rules**. Sources disagree between years and exams, so no exam is named as authoritative and every number is editable. The tool changes size and file size only; it cannot check that a photo meets a portal's content rules.
* Not included by design: video, OCR, AI background removal, any server processing.

## Testing

* Unit tests (`tests/files-and-text.test.ts`, `tests/engines.developer.test.ts`): ZIP structure and CRC, padding validity, page-range parsing, QR payloads and a real decoder round trip, and the text/data engines.
* Browser tests: `qa/file_tools.py` (see `qa/README.md`) — every tool, real downloads, independent verification.
* Not covered: Safari and Firefox (tested in Chromium only), very large files on low-memory phones, and the behaviour of any specific exam portal.

## Adding another file tool

1. Write the interface in `src/components/files/` (default export taking `{ preset?: string }`); reuse `BatchShell` if it is "many images in, many files out".
2. Register it in `ClientToolHost.tsx` and add its id to `ClientComponent` in `src/tools/types.ts`.
3. Add the definition to `src/tools/defs/image-pdf.ts` using the `files(...)` helper, then add it to a group in `categories.ts`.
4. Add a test group to `qa/file_tools.py`. Verify downloads with an independent tool, not with the code under test.
