/**
 * The single source of truth for unit conversion. Every converter page, the general converter and the
 * tests read from this registry — conversion factors must never be duplicated anywhere else.
 *
 * Linear categories: `factor` = how many BASE units one of this unit equals (so value * factor = base).
 * Non-linear categories (temperature, fuel economy) supply toBase/fromBase functions instead.
 */
import { clean } from "./numeric";

export type Unit = { id: string; label: string; symbol: string; factor: number };

export type UnitCategory = {
  id: string;
  label: string;
  base: string;
  units: Unit[];
  /** Optional non-linear conversion into / out of the base unit. */
  toBase?: (value: number, unitId: string) => number;
  fromBase?: (value: number, unitId: string) => number;
  /** Source for the factors, shown on the page where relevant. */
  note?: string;
};

const GAL_US = 0.003785411784; // m³ — exactly 231 in³ (NIST SP 811)
const GAL_UK = 0.00454609; // m³ — exact by definition (Weights and Measures Act 1985)
const MILE = 1609.344; // m — exact (international mile)

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    id: "length", label: "Length", base: "m",
    note: "International yard and pound agreement (1959): 1 inch = 25.4 mm exactly.",
    units: [
      { id: "km", label: "Kilometre", symbol: "km", factor: 1000 },
      { id: "m", label: "Metre", symbol: "m", factor: 1 },
      { id: "cm", label: "Centimetre", symbol: "cm", factor: 0.01 },
      { id: "mm", label: "Millimetre", symbol: "mm", factor: 0.001 },
      { id: "um", label: "Micrometre", symbol: "µm", factor: 1e-6 },
      { id: "nm", label: "Nanometre", symbol: "nm", factor: 1e-9 },
      { id: "mi", label: "Mile", symbol: "mi", factor: MILE },
      { id: "yd", label: "Yard", symbol: "yd", factor: 0.9144 },
      { id: "ft", label: "Foot", symbol: "ft", factor: 0.3048 },
      { id: "in", label: "Inch", symbol: "in", factor: 0.0254 },
      { id: "nmi", label: "Nautical mile", symbol: "nmi", factor: 1852 },
    ],
  },
  {
    id: "mass", label: "Weight / mass", base: "kg",
    note: "1 pound = 0.45359237 kg exactly. Tonne = metric tonne (1,000 kg).",
    units: [
      { id: "t", label: "Tonne (metric)", symbol: "t", factor: 1000 },
      { id: "quintal", label: "Quintal", symbol: "q", factor: 100 },
      { id: "kg", label: "Kilogram", symbol: "kg", factor: 1 },
      { id: "g", label: "Gram", symbol: "g", factor: 0.001 },
      { id: "mg", label: "Milligram", symbol: "mg", factor: 1e-6 },
      { id: "ug", label: "Microgram", symbol: "µg", factor: 1e-9 },
      { id: "ct", label: "Carat", symbol: "ct", factor: 0.0002 },
      { id: "lb", label: "Pound", symbol: "lb", factor: 0.45359237 },
      { id: "oz", label: "Ounce", symbol: "oz", factor: 0.028349523125 },
      { id: "st", label: "Stone", symbol: "st", factor: 6.35029318 },
      { id: "ton_us", label: "US (short) ton", symbol: "short ton", factor: 907.18474 },
      { id: "ton_uk", label: "UK (long) ton", symbol: "long ton", factor: 1016.0469088 },
    ],
  },
  {
    id: "temperature", label: "Temperature", base: "°C",
    units: [
      { id: "c", label: "Celsius", symbol: "°C", factor: 1 },
      { id: "f", label: "Fahrenheit", symbol: "°F", factor: 1 },
      { id: "k", label: "Kelvin", symbol: "K", factor: 1 },
      { id: "r", label: "Rankine", symbol: "°R", factor: 1 },
    ],
    toBase: (v, u) => (u === "f" ? ((v - 32) * 5) / 9 : u === "k" ? v - 273.15 : u === "r" ? ((v - 491.67) * 5) / 9 : v),
    fromBase: (v, u) => (u === "f" ? (v * 9) / 5 + 32 : u === "k" ? v + 273.15 : u === "r" ? ((v + 273.15) * 9) / 5 : v),
  },
  {
    id: "area", label: "Area", base: "m²",
    units: [
      { id: "km2", label: "Square kilometre", symbol: "km²", factor: 1e6 },
      { id: "ha", label: "Hectare", symbol: "ha", factor: 1e4 },
      { id: "m2", label: "Square metre", symbol: "m²", factor: 1 },
      { id: "cm2", label: "Square centimetre", symbol: "cm²", factor: 1e-4 },
      { id: "mm2", label: "Square millimetre", symbol: "mm²", factor: 1e-6 },
      { id: "mi2", label: "Square mile", symbol: "mi²", factor: MILE * MILE },
      { id: "ac", label: "Acre", symbol: "ac", factor: 4046.8564224 },
      { id: "yd2", label: "Square yard", symbol: "yd²", factor: 0.83612736 },
      { id: "ft2", label: "Square foot", symbol: "ft²", factor: 0.09290304 },
      { id: "in2", label: "Square inch", symbol: "in²", factor: 0.00064516 },
    ],
  },
  {
    id: "volume", label: "Volume", base: "m³",
    note: "US gallon = 231 cubic inches; imperial (UK) gallon = 4.54609 litres.",
    units: [
      { id: "m3", label: "Cubic metre", symbol: "m³", factor: 1 },
      { id: "l", label: "Litre", symbol: "L", factor: 0.001 },
      { id: "ml", label: "Millilitre", symbol: "mL", factor: 1e-6 },
      { id: "gal_us", label: "US gallon", symbol: "US gal", factor: GAL_US },
      { id: "qt_us", label: "US quart", symbol: "US qt", factor: GAL_US / 4 },
      { id: "pt_us", label: "US pint", symbol: "US pt", factor: GAL_US / 8 },
      { id: "cup_us", label: "US cup", symbol: "US cup", factor: GAL_US / 16 },
      { id: "floz_us", label: "US fluid ounce", symbol: "US fl oz", factor: GAL_US / 128 },
      { id: "tbsp_us", label: "US tablespoon", symbol: "US tbsp", factor: GAL_US / 256 },
      { id: "tsp_us", label: "US teaspoon", symbol: "US tsp", factor: GAL_US / 768 },
      { id: "gal_uk", label: "Imperial gallon", symbol: "imp gal", factor: GAL_UK },
      { id: "pt_uk", label: "Imperial pint", symbol: "imp pt", factor: GAL_UK / 8 },
      { id: "floz_uk", label: "Imperial fluid ounce", symbol: "imp fl oz", factor: GAL_UK / 160 },
      { id: "ft3", label: "Cubic foot", symbol: "ft³", factor: 0.028316846592 },
      { id: "in3", label: "Cubic inch", symbol: "in³", factor: 1.6387064e-5 },
    ],
  },
  {
    id: "speed", label: "Speed", base: "m/s",
    units: [
      { id: "ms", label: "Metres per second", symbol: "m/s", factor: 1 },
      { id: "kmh", label: "Kilometres per hour", symbol: "km/h", factor: 1000 / 3600 },
      { id: "mph", label: "Miles per hour", symbol: "mph", factor: 0.44704 },
      { id: "kn", label: "Knot", symbol: "kn", factor: 1852 / 3600 },
      { id: "fts", label: "Feet per second", symbol: "ft/s", factor: 0.3048 },
    ],
  },
  {
    id: "time", label: "Time", base: "s",
    note: "Months and years use the Gregorian averages (30.436875 days and 365.2425 days).",
    units: [
      { id: "ms", label: "Millisecond", symbol: "ms", factor: 0.001 },
      { id: "s", label: "Second", symbol: "s", factor: 1 },
      { id: "min", label: "Minute", symbol: "min", factor: 60 },
      { id: "h", label: "Hour", symbol: "h", factor: 3600 },
      { id: "d", label: "Day", symbol: "d", factor: 86400 },
      { id: "wk", label: "Week", symbol: "wk", factor: 604800 },
      { id: "mo", label: "Month (average)", symbol: "mo", factor: 2629746 },
      { id: "yr", label: "Year (average)", symbol: "yr", factor: 31556952 },
    ],
  },
  {
    id: "data", label: "Digital storage", base: "B",
    note: "KB/MB/GB use powers of 1,000 (SI); KiB/MiB/GiB use powers of 1,024 (IEC).",
    units: [
      { id: "bit", label: "Bit", symbol: "bit", factor: 0.125 },
      { id: "B", label: "Byte", symbol: "B", factor: 1 },
      { id: "KB", label: "Kilobyte (1,000 B)", symbol: "KB", factor: 1e3 },
      { id: "MB", label: "Megabyte", symbol: "MB", factor: 1e6 },
      { id: "GB", label: "Gigabyte", symbol: "GB", factor: 1e9 },
      { id: "TB", label: "Terabyte", symbol: "TB", factor: 1e12 },
      { id: "KiB", label: "Kibibyte (1,024 B)", symbol: "KiB", factor: 1024 },
      { id: "MiB", label: "Mebibyte", symbol: "MiB", factor: 1024 ** 2 },
      { id: "GiB", label: "Gibibyte", symbol: "GiB", factor: 1024 ** 3 },
      { id: "TiB", label: "Tebibyte", symbol: "TiB", factor: 1024 ** 4 },
    ],
  },
  {
    id: "fuel", label: "Fuel economy", base: "km/L",
    note: "Fuel economy is the reciprocal of consumption, so converting between km/L and L/100 km is not a simple multiplication.",
    units: [
      { id: "kmpl", label: "Kilometres per litre", symbol: "km/L", factor: 1 },
      { id: "l100", label: "Litres per 100 km", symbol: "L/100 km", factor: 1 },
      { id: "mpg_us", label: "Miles per US gallon", symbol: "mpg (US)", factor: MILE / 1000 / (GAL_US * 1000) },
      { id: "mpg_uk", label: "Miles per imperial gallon", symbol: "mpg (UK)", factor: MILE / 1000 / (GAL_UK * 1000) },
    ],
    toBase: (v, u) => (u === "l100" ? 100 / v : v * (UNIT_BY_ID.fuel.get(u)?.factor ?? 1)),
    fromBase: (v, u) => (u === "l100" ? 100 / v : v / (UNIT_BY_ID.fuel.get(u)?.factor ?? 1)),
  },
];

export const CATEGORY_BY_ID = new Map(UNIT_CATEGORIES.map((c) => [c.id, c]));
const UNIT_BY_ID: Record<string, Map<string, Unit>> = Object.fromEntries(
  UNIT_CATEGORIES.map((c) => [c.id, new Map(c.units.map((u) => [u.id, u]))]),
);

export function getUnit(categoryId: string, unitId: string): Unit | undefined {
  return UNIT_BY_ID[categoryId]?.get(unitId);
}

/** Convert `value` between two units of the same category. Throws on unknown ids. */
export function convert(categoryId: string, from: string, to: string, value: number): number {
  const category = CATEGORY_BY_ID.get(categoryId);
  const a = getUnit(categoryId, from);
  const b = getUnit(categoryId, to);
  if (!category || !a || !b) throw new Error(`Unknown unit: ${categoryId}/${from}/${to}`);
  if (from === to) return value;
  if (category.toBase && category.fromBase) {
    return clean(category.fromBase(category.toBase(value, from), to));
  }
  return clean((value * a.factor) / b.factor);
}

/** How many `to` units make one `from` unit — used for the "1 ft = 0.3048 m" line. */
export function conversionFactor(categoryId: string, from: string, to: string): number | null {
  const category = CATEGORY_BY_ID.get(categoryId);
  if (!category || category.toBase) return null;
  return convert(categoryId, from, to, 1);
}
