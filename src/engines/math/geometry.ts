import type { EngineMap } from "@/tools/types";
import { N, T, formatNumber } from "@/lib/format";
import { clean } from "@/lib/numeric";
import { fail, num, ok, str } from "../helpers";

const f = (n: number) => formatNumber(clean(n), { maxDecimals: 6 });
const deg = (rad: number) => clean((rad * 180) / Math.PI);
const unitOf = (v: Parameters<typeof str>[0]) => { const u = str(v, "unit"); return u === "units" ? "" : u; };
const sq = (u: string) => (u ? `${u}²` : "square units");
const cu = (u: string) => (u ? `${u}³` : "cubic units");

export type TriangleResult = { a: number; b: number; c: number; A: number; B: number; C: number };

function describeTriangle(t: TriangleResult) {
  const [x, y, z] = [t.a, t.b, t.c].sort((p, q) => p - q);
  const eps = 1e-9 * Math.max(1, z * z);
  const bySides = Math.abs(x - y) < 1e-9 * z && Math.abs(y - z) < 1e-9 * z ? "equilateral" : Math.abs(x - y) < 1e-9 * z || Math.abs(y - z) < 1e-9 * z ? "isosceles" : "scalene";
  const diff = x * x + y * y - z * z;
  const byAngles = Math.abs(diff) < eps ? "right" : diff > 0 ? "acute" : "obtuse";
  return { bySides, byAngles };
}

function triangleOutput(t: TriangleResult, steps: string[]) {
  const s = (t.a + t.b + t.c) / 2;
  const area = Math.sqrt(Math.max(0, s * (s - t.a) * (s - t.b) * (s - t.c)));
  const { bySides, byAngles } = describeTriangle(t);
  const inradius = area / s;
  const circumradius = (t.a * t.b * t.c) / (4 * area);
  return ok({
    primary: { label: "Area", value: N(clean(area), undefined, 6) },
    secondary: [
      { label: "Side a, b, c", value: T(`${f(t.a)},  ${f(t.b)},  ${f(t.c)}`) },
      { label: "Angle A, B, C", value: T(`${f(deg(t.A))}°,  ${f(deg(t.B))}°,  ${f(deg(t.C))}°`) },
      { label: "Perimeter", value: N(clean(t.a + t.b + t.c), undefined, 6) },
      { label: "Type", value: T(`${bySides}, ${byAngles}-angled`) },
      { label: "Inradius", value: N(clean(inradius), undefined, 6) },
      { label: "Circumradius", value: N(clean(circumradius), undefined, 6) },
    ],
    steps: [...steps, `Semi-perimeter s = (a + b + c) ÷ 2 = ${f(s)}`, `Heron's formula: area = √(s(s − a)(s − b)(s − c)) = ${f(area)}`],
  });
}

const fromSides = (a: number, b: number, c: number): TriangleResult => ({
  a, b, c,
  A: Math.acos(Math.max(-1, Math.min(1, (b * b + c * c - a * a) / (2 * b * c)))),
  B: Math.acos(Math.max(-1, Math.min(1, (a * a + c * c - b * b) / (2 * a * c)))),
  C: Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - c * c) / (2 * a * b)))),
});

export const engines: EngineMap = {
  "pythagorean-theorem-calculator": (v) => {
    const unknown = str(v, "unknown");
    let a: number, b: number, c: number;
    if (unknown === "hyp") {
      a = num(v, "leg_a"); b = num(v, "leg_b");
      c = Math.hypot(a, b);
    } else {
      c = num(v, "hyp"); a = num(v, "leg_a");
      if (a >= c) return fail("A leg must be shorter than the hypotenuse, which is always the longest side.", "leg_a");
      b = Math.sqrt(c * c - a * a);
    }
    const A = Math.atan2(a, b), B = Math.atan2(b, a);
    const ints = [a, b, c].every((x) => Number.isInteger(clean(x)));
    return ok({
      primary: { label: unknown === "hyp" ? "Hypotenuse c" : "Missing leg b", value: N(clean(unknown === "hyp" ? c : b), undefined, 8) },
      secondary: [
        { label: "Sides a, b, c", value: T(`${f(a)},  ${f(b)},  ${f(c)}`) },
        { label: "Area", value: N(clean((a * b) / 2), undefined, 6) },
        { label: "Perimeter", value: N(clean(a + b + c), undefined, 6) },
        { label: "Acute angles", value: T(`${f(deg(A))}° and ${f(deg(B))}°`) },
        ...(ints ? [{ label: "Pythagorean triple", value: T(`Yes — ${f(a)}² + ${f(b)}² = ${f(c)}²`) }] : []),
      ],
      steps: unknown === "hyp" ? ["a² + b² = c²", `c = √(${f(a)}² + ${f(b)}²) = √${f(a * a + b * b)} = ${f(c)}`] : ["a² + b² = c², so b = √(c² − a²)", `b = √(${f(c)}² − ${f(a)}²) = √${f(c * c - a * a)} = ${f(b)}`],
    });
  },

  "triangle-calculator": (v) => {
    const mode = str(v, "mode");
    if (mode === "sss") {
      const a = num(v, "a"), b = num(v, "b"), c = num(v, "c");
      if (a + b <= c || a + c <= b || b + c <= a) return fail(`These sides can't form a triangle: each side must be shorter than the sum of the other two (${f(a)}, ${f(b)}, ${f(c)}).`, "c");
      return triangleOutput(fromSides(a, b, c), ["Angles come from the law of cosines: cos A = (b² + c² − a²) ÷ 2bc, and similarly for B and C"]);
    }
    if (mode === "sas") {
      const a = num(v, "sas_a"), b = num(v, "sas_b"), C = num(v, "sas_angle");
      if (C <= 0 || C >= 180) return fail("The angle between the two sides must be greater than 0° and less than 180°.", "sas_angle");
      const c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos((C * Math.PI) / 180));
      return triangleOutput(fromSides(a, b, c), [`Third side by the law of cosines: c² = a² + b² − 2ab·cos C = ${f(c * c)}, so c = ${f(c)}`]);
    }
    const A = num(v, "asa_A"), B = num(v, "asa_B"), side = num(v, "asa_c");
    if (A + B >= 180) return fail("Two angles of a triangle must add up to less than 180°.", "asa_B");
    const C = 180 - A - B;
    const rad = (x: number) => (x * Math.PI) / 180;
    const a = (side * Math.sin(rad(A))) / Math.sin(rad(C)), b = (side * Math.sin(rad(B))) / Math.sin(rad(C));
    return triangleOutput({ a, b, c: side, A: rad(A), B: rad(B), C: rad(C) }, [`Third angle C = 180° − ${f(A)}° − ${f(B)}° = ${f(C)}°`, "Other sides by the law of sines: a ÷ sin A = b ÷ sin B = c ÷ sin C"]);
  },

  "circle-calculator": (v) => {
    const known = str(v, "known"), x = num(v, "value");
    if (x <= 0) return fail("Enter a value greater than zero.", "value");
    const r = known === "radius" ? x : known === "diameter" ? x / 2 : known === "circumference" ? x / (2 * Math.PI) : Math.sqrt(x / Math.PI);
    const u = unitOf(v);
    return ok({
      primary: { label: "Area", value: N(clean(Math.PI * r * r), u ? sq(u) : undefined, 8) },
      secondary: [
        { label: "Radius", value: N(clean(r), u || undefined, 8) },
        { label: "Diameter", value: N(clean(2 * r), u || undefined, 8) },
        { label: "Circumference", value: N(clean(2 * Math.PI * r), u || undefined, 8) },
      ],
      steps: [known === "radius" ? `Radius r = ${f(x)}` : known === "diameter" ? `Radius r = diameter ÷ 2 = ${f(r)}` : known === "circumference" ? `Radius r = C ÷ 2π = ${f(r)}` : `Radius r = √(A ÷ π) = ${f(r)}`, `Diameter d = 2r = ${f(2 * r)}`, `Circumference C = 2πr = ${f(2 * Math.PI * r)}`, `Area A = πr² = ${f(Math.PI * r * r)}`],
    });
  },

  "area-volume-calculator": (v) => {
    const shape = str(v, "shape");
    const u = unitOf(v);
    const a2 = (x: number) => N(clean(x), u ? sq(u) : undefined, 6), v3 = (x: number) => N(clean(x), u ? cu(u) : undefined, 6), l1 = (x: number) => N(clean(x), u || undefined, 6);
    const pos = (id: string) => { const x = num(v, id); return x; };
    switch (shape) {
      case "rectangle": { const l = pos("length"), w = pos("width"); return ok({ primary: { label: "Area", value: a2(l * w) }, secondary: [{ label: "Perimeter", value: l1(2 * (l + w)) }, { label: "Diagonal", value: l1(Math.hypot(l, w)) }], steps: [`Area = length × width = ${f(l)} × ${f(w)} = ${f(l * w)}`, `Perimeter = 2 × (${f(l)} + ${f(w)}) = ${f(2 * (l + w))}`] }); }
      case "triangle": { const b = pos("base"), h = pos("height"); return ok({ primary: { label: "Area", value: a2((b * h) / 2) }, steps: [`Area = ½ × base × height = ½ × ${f(b)} × ${f(h)} = ${f((b * h) / 2)}`], notes: ["Know three sides instead? Use the triangle calculator."] }); }
      case "parallelogram": { const b = pos("base"), h = pos("height"); return ok({ primary: { label: "Area", value: a2(b * h) }, steps: [`Area = base × height = ${f(b)} × ${f(h)} = ${f(b * h)}`], notes: ["The height is the perpendicular distance between the parallel sides, not the slanted side."] }); }
      case "trapezoid": { const p = pos("parallel_a"), q = pos("parallel_b"), h = pos("height"); return ok({ primary: { label: "Area", value: a2(((p + q) / 2) * h) }, steps: [`Area = ½ × (a + b) × height = ½ × (${f(p)} + ${f(q)}) × ${f(h)} = ${f(((p + q) / 2) * h)}`] }); }
      case "cube": { const s = pos("side"); return ok({ primary: { label: "Volume", value: v3(s ** 3) }, secondary: [{ label: "Surface area", value: a2(6 * s * s) }, { label: "Face diagonal", value: l1(s * Math.SQRT2) }, { label: "Space diagonal", value: l1(s * Math.sqrt(3)) }], steps: [`Volume = side³ = ${f(s)}³ = ${f(s ** 3)}`, `Surface area = 6 × side² = ${f(6 * s * s)}`] }); }
      case "cuboid": { const l = pos("length"), w = pos("width"), h = pos("height"); return ok({ primary: { label: "Volume", value: v3(l * w * h) }, secondary: [{ label: "Surface area", value: a2(2 * (l * w + l * h + w * h)) }, { label: "Space diagonal", value: l1(Math.sqrt(l * l + w * w + h * h)) }], steps: [`Volume = l × w × h = ${f(l)} × ${f(w)} × ${f(h)} = ${f(l * w * h)}`, `Surface area = 2(lw + lh + wh) = ${f(2 * (l * w + l * h + w * h))}`] }); }
      case "cylinder": { const r = pos("radius"), h = pos("height"); return ok({ primary: { label: "Volume", value: v3(Math.PI * r * r * h) }, secondary: [{ label: "Curved surface area", value: a2(2 * Math.PI * r * h) }, { label: "Total surface area", value: a2(2 * Math.PI * r * (r + h)) }], steps: [`Volume = πr²h = π × ${f(r)}² × ${f(h)} = ${f(Math.PI * r * r * h)}`, `Curved surface = 2πrh = ${f(2 * Math.PI * r * h)}`, `Total surface = 2πr(r + h) = ${f(2 * Math.PI * r * (r + h))}`] }); }
      case "cone": { const r = pos("radius"), h = pos("height"); const sl = Math.hypot(r, h); return ok({ primary: { label: "Volume", value: v3((Math.PI * r * r * h) / 3) }, secondary: [{ label: "Slant height", value: l1(sl) }, { label: "Curved surface area", value: a2(Math.PI * r * sl) }, { label: "Total surface area", value: a2(Math.PI * r * (r + sl)) }], steps: [`Volume = ⅓πr²h = ⅓ × π × ${f(r)}² × ${f(h)} = ${f((Math.PI * r * r * h) / 3)}`, `Slant height l = √(r² + h²) = ${f(sl)}`, `Curved surface = πrl = ${f(Math.PI * r * sl)}`] }); }
      case "sphere": { const r = pos("radius"); return ok({ primary: { label: "Volume", value: v3((4 / 3) * Math.PI * r ** 3) }, secondary: [{ label: "Surface area", value: a2(4 * Math.PI * r * r) }, { label: "Great-circle circumference", value: l1(2 * Math.PI * r) }], steps: [`Volume = (4/3)πr³ = (4/3) × π × ${f(r)}³ = ${f((4 / 3) * Math.PI * r ** 3)}`, `Surface area = 4πr² = ${f(4 * Math.PI * r * r)}`] }); }
      default: return fail("Choose a shape.", "shape");
    }
  },
};
