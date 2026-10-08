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
