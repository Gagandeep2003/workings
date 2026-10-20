# Adding a tool

A tool is **one metadata entry + one pure function**. No page file is copied.

1. **Write the engine** in `src/engines/<category>/<topic>.ts`:
   ```ts
   export const engines: EngineMap = {
     "my-tool": (v, ctx) => {
       const x = num(v, "x");                      // inputs are already parsed and validated by the runtime
       if (x === 0) return fail("x can't be zero.", "x");   // field-level error, shown next to the input
       return ok({ primary: { label: "Result", value: N(x * 2) }, steps: [`x × 2 = ${x * 2}`] });
     },
   };
   ```
   Use `lib/numeric` (rounding), `lib/dates` (calendar maths), `lib/units` (conversion factors) — never re-implement them.
   New engine file? Register it in `src/engines/loaders.ts` and in the `EngineModule` type (`src/tools/types.ts`).
2. **Add the definition** to `src/tools/defs/<category>.ts` using `group({...defaults}, [ {...} ])`: `id`, titles, SEO title/description,
   `keywords`, `aliases`, `phrases`, `inputs`, `output.primary` (the label(s) the engine returns), `formula`, `howItWorks`
   (use `[[other-tool-id|anchor text]]` for contextual links), `examples`, `assumptions`, `relatedTools`, `commercialIntent`, `adProfile`.
   Rule-dependent tools must add `regulatory` (region, appliesTo, effectiveFrom, reviewedOn, https sources) and `reviewal: "periodic"`.
3. **List it on its category page** in `src/tools/categories.ts` (`groups[].toolIds`).
4. **Write tests** in `tests/engines.<category>.test.ts`: normal values, decimals, zero, boundaries, rounding, invalid input, errors.
   Compute expected values independently (a Python `decimal` script, a textbook example) — not by copying the function's output.
5. Run `npm run verify`. The registry validator fails the build if any required field, route, link, example or label is wrong.

## Browser-only tools (files, images, PDFs, QR codes)

Tools that work on files or need a custom interface are *client tools*: they have no engine. Set `client: { component, preset? }` and `engineModule: "client"`, leave `inputs` and `examples` empty, and instead provide `specs` (formats and limits, at least 4), `practicalExamples` (at least 2 scenarios with expected results) and at least 4 FAQs. The page template shows these in place of the formula/worked-example blocks. The interface itself is a lazy-loaded component registered in `src/components/tool/ClientToolHost.tsx`. Client tools must set `shareable: false`. Full details and the testing recipe are in [FILE_TOOLS.md](FILE_TOOLS.md).

## Fields added in the October 2026 redesign

* `icon` (required) — a Lucide icon name, shown on cards and the tool page. Names live in `src/components/icon-data.ts`, which is **generated**: add the name to `TOOL` in
  `scripts/gen-icons.ts`, then run `npx tsx scripts/gen-icons.ts /path/to/lucide-static/icons` (get the folder with `npm pack lucide-static`). Only listed icons are copied.
* `addedOn` — the real date (`YYYY-MM-DD`) you publish the tool. It feeds "Recently added" and `datePublished`/sitemap `lastmod`. Never invent one; leave it off if unknown.
* `shortDescription` must be **8–18 words** (it fits a card) — the validator enforces it. `output.primary` labels may end in `…` to match a prefix.
* `ruleFree: true` — exams only: for general tools (planners, trackers) that apply no exam-specific rule, so no `regulatory` block is needed. Every other exam tool must cite its rule.
* `persist: true` — keep the visitor's entries in `localStorage` (device only). Don't use it for tools that handle secrets.
* Engines may be `async` (the hash tool uses the Web Crypto API). Tests call them with `runAsync` from `tests/util.ts`.
* A category group may list `alsoToolIds` — tools from other categories shown as "also useful" (the Exams hub uses this for the generic score and percentage tools).
* The curated home-page lists (popular, spotlight sections, search chips) are in `src/tools/home.ts`; the registry validator checks every id there.
* New tools need **inbound links**: add the new id to the `relatedTools` of two or three existing tools it naturally follows, or the validator reports it as an orphan.
* For exam tools, verify the scheme against the official notice (or, if you can't open it, several independent sources) **before** writing the engine; say what you couldn't verify in `regulatory.note`
  and add the tool to the table in `MAINTENANCE.md`. Where sources disagree, make the disputed value an input or show both outcomes instead of choosing silently.

