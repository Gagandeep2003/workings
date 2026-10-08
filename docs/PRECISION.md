# Numerical precision rules

1. **Display** — numbers are cleaned to 12 significant digits (removes `0.1 + 0.2 = 0.30000000000000004` noise), grouped with separators, and shown with at
   most 6 decimals (percentages: up to 4). Values ≥ 10¹⁵ or < 10⁻⁸ switch to scientific notation. Small non-zero values are never rounded to zero.
2. **Rounding** — half away from zero, performed on the *decimal string* (`round(1.005, 2) = 1.01`), implemented once in `lib/numeric.ts`.
3. **Money** — rounded to 2 places. Loan schedules are built in **integer minor units** (cents/paise): each month's interest is rounded once, and
   the final payment clears the exact remaining balance, so a balance always ends at exactly 0. EMI pages show `EMI × n` (the figure people expect);
   the amortization page shows the exact schedule, so the two differ by a few paise on purpose, and both pages say so.
4. **Sums** of user lists use scaled integers (`sumExact`), fractions/HCF/LCM/combinatorics use `BigInt`.
5. **Dates** are civil-calendar arithmetic on integer day numbers (`lib/dates.ts`) — no `Date` objects, so no time-zone or DST bugs. Only the time-zone
   tools use `Intl`, and they detect and report DST gaps and overlaps.
6. **Conversions** read one table (`lib/units.ts`) using exact legal definitions (1 in = 25.4 mm, 1 lb = 0.45359237 kg, US gallon = 231 in³…).
7. **Percentages** — *increase/decrease/change* are relative to the original value (`(new − old) / |old|`); *difference* is relative to the average of the
   two values. The pages say which one they use.
8. Inputs are limited to |x| ≤ 10¹⁵ unless a field sets its own max; engines reject non-finite results instead of showing `NaN`/`Infinity`.
